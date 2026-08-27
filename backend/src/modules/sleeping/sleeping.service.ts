import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../notifications/notification.service.js';

const prisma = new PrismaClient();
const notificationService = new NotificationService();

export interface DetectOptions {
  thresholdDays?: number;
  autoNotify?: boolean;
}

export interface GetSleepingQuery {
  riskScore?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class SleepingService {
  /**
   * Helper to get default threshold by tenant industry
   */
  private getDefaultThreshold(industryType: string): number {
    switch (industryType?.toLowerCase()) {
      case 'milk': return 7;
      case 'water': return 14;
      case 'lpg': return 30;
      case 'oil': return 30;
      default: return 14;
    }
  }

  /**
   * Run automated churn detection sweep across tenant customers
   */
  async detectSleepingCustomers(tenantId: string, options: DetectOptions = {}) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    if (!tenant) throw new Error('Tenant not found');

    const thresholdDays = options.thresholdDays || this.getDefaultThreshold(tenant.industryType);
    const autoNotify = options.autoNotify !== undefined ? options.autoNotify : true;

    const customers = await prisma.customer.findMany({
      where: { tenantId },
      include: {
        orders: {
          where: { status: 'delivered' },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        zone: true
      }
    });

    const now = new Date();
    let sleepingCount = 0;
    let churnedCount = 0;
    const detectedList: any[] = [];

    for (const cust of customers) {
      const lastOrder = cust.orders[0];
      const lastDate = lastOrder ? new Date(lastOrder.createdAt) : new Date(cust.createdAt);
      const diffMs = now.getTime() - lastDate.getTime();
      const daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let riskScore: 'low' | 'medium' | 'high' | 'critical' = 'low';

      if (daysInactive >= thresholdDays * 2.5) {
        riskScore = 'critical';
      } else if (daysInactive >= thresholdDays * 1.5) {
        riskScore = 'high';
      } else if (daysInactive >= thresholdDays) {
        riskScore = 'medium';
      }

      let newStatus = cust.status;

      if (daysInactive >= thresholdDays * 3 && cust.status !== 'churned') {
        newStatus = 'churned';
        churnedCount++;
      } else if (daysInactive >= thresholdDays && cust.status === 'active') {
        newStatus = 'sleeping';
        sleepingCount++;

        // Trigger automated re-engagement alert if requested
        if (autoNotify) {
          try {
            await notificationService.triggerEventNotification(tenantId, 'sleeping_alert', {
              customerId: cust.id,
              recipientPhone: cust.phone,
              data: {
                customer_name: cust.name,
                days_inactive: daysInactive
              }
            });
          } catch (e) {
            console.error(`Failed to auto-notify sleeping customer ${cust.id}:`, e);
          }
        }
      }

      // Update customer status if changed
      if (newStatus !== cust.status) {
        await prisma.customer.update({
          where: { id: cust.id },
          data: { status: newStatus }
        });
      }

      if (daysInactive >= thresholdDays) {
        detectedList.push({
          customerId: cust.id,
          name: cust.name,
          phone: cust.phone,
          zone: cust.zone?.name || 'Unassigned',
          daysInactive,
          lastDeliveryDate: lastOrder ? lastOrder.createdAt : null,
          riskScore,
          status: newStatus
        });
      }
    }

    return {
      scannedCount: customers.length,
      thresholdDays,
      sleepingDetectedCount: sleepingCount,
      churnedDetectedCount: churnedCount,
      detectedCustomers: detectedList
    };
  }

  /**
   * Get list of sleeping & churn risk customers
   */
  async getSleepingCustomers(tenantId: string, query: GetSleepingQuery = {}) {
    const { riskScore, status, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const thresholdDays = this.getDefaultThreshold(tenant?.industryType || 'water');

    const where: any = { tenantId };

    if (status) {
      where.status = status;
    } else {
      where.status = { in: ['sleeping', 'churned'] };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          orders: {
            where: { status: 'delivered' },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          zone: true
        }
      }),
      prisma.customer.count({ where })
    ]);

    const now = new Date();
    const formatted = customers.map(cust => {
      const lastOrder = cust.orders[0];
      const lastDate = lastOrder ? new Date(lastOrder.createdAt) : new Date(cust.createdAt);
      const daysInactive = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      let computedRisk: 'medium' | 'high' | 'critical' = 'medium';
      if (daysInactive >= thresholdDays * 2.5) computedRisk = 'critical';
      else if (daysInactive >= thresholdDays * 1.5) computedRisk = 'high';

      return {
        id: cust.id,
        name: cust.name,
        phone: cust.phone,
        email: cust.email,
        address: cust.address,
        zoneName: cust.zone?.name || 'Unassigned',
        daysInactive,
        lastDeliveryDate: lastOrder ? lastOrder.createdAt : null,
        riskScore: computedRisk,
        status: cust.status
      };
    });

    // Filter by risk score if requested
    const filteredResults = riskScore ? formatted.filter(f => f.riskScore === riskScore) : formatted;

    return {
      customers: filteredResults,
      total: filteredResults.length,
      page,
      limit,
      totalPages: Math.ceil(filteredResults.length / limit)
    };
  }

  /**
   * Reactivate a sleeping/churned customer back to active status
   */
  async reactivateCustomer(tenantId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId }
    });
    if (!customer) throw new Error('Customer not found');

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { status: 'active' }
    });

    return updated;
  }

  /**
   * Manually trigger re-engagement promo to a sleeping customer
   */
  async triggerReengagementPromo(tenantId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        orders: { take: 1, orderBy: { createdAt: 'desc' }, include: { items: { include: { product: true } } } }
      }
    });

    if (!customer) throw new Error('Customer not found');

    const lastProduct = customer.orders[0]?.items[0]?.product?.name || 'Daily Container';

    const result = await notificationService.triggerEventNotification(tenantId, 'sleeping_alert', {
      customerId: customer.id,
      recipientPhone: customer.phone,
      data: {
        customer_name: customer.name,
        product_name: lastProduct
      }
    });

    return result;
  }

  /**
   * Get tenant churn KPI statistics
   */
  async getSleepingStats(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const thresholdDays = this.getDefaultThreshold(tenant?.industryType || 'water');

    const [activeCount, sleepingCount, churnedCount] = await Promise.all([
      prisma.customer.count({ where: { tenantId, status: 'active' } }),
      prisma.customer.count({ where: { tenantId, status: 'sleeping' } }),
      prisma.customer.count({ where: { tenantId, status: 'churned' } })
    ]);

    const totalCustomers = activeCount + sleepingCount + churnedCount;
    const retentionRate = totalCustomers > 0 ? (activeCount / totalCustomers) * 100 : 100;

    return {
      thresholdDays,
      activeCount,
      sleepingCount,
      churnedCount,
      totalCustomers,
      retentionRate: Math.round(retentionRate * 10) / 10
    };
  }

  /**
   * Get radar overview response for sleeping/churn risk customers UI
   */
  async getSleepingRadar(tenantId: string) {
    const stats = await this.getSleepingStats(tenantId);
    const customersResult = await this.getSleepingCustomers(tenantId, { limit: 100 });
    return {
      thresholdDays: stats.thresholdDays,
      totalSleepingCount: stats.sleepingCount,
      sleepingCustomers: customersResult.customers.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email || null,
        status: c.status,
        lastOrderDate: c.lastOrderDate || null,
        daysInactive: c.daysInactive || stats.thresholdDays,
        churnRisk: c.status === 'churned' ? 'CRITICAL' : c.daysInactive > 30 ? 'HIGH' : 'MEDIUM'
      }))
    };
  }
}
