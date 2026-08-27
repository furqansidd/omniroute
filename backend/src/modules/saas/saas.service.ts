import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TierConfig {
  name: string;
  maxCustomers: number;
  maxMonthlyOrders: number;
  maxRiders: number;
  priceMonthly: number;
}

export const TIER_LIMITS: Record<string, TierConfig> = {
  starter: { name: 'Starter Tier', maxCustomers: 100, maxMonthlyOrders: 500, maxRiders: 2, priceMonthly: 49 },
  professional: { name: 'Professional Tier', maxCustomers: 1000, maxMonthlyOrders: 5000, maxRiders: 10, priceMonthly: 149 },
  enterprise: { name: 'Enterprise Tier', maxCustomers: 999999, maxMonthlyOrders: 999999, maxRiders: 999999, priceMonthly: 399 }
};

export class SaasService {
  /**
   * Calculate real-time tenant resource usage vs tier limits
   */
  async getTenantMetering(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) throw new Error('Tenant not found');

    const tierKey = (tenant.subscriptionTier || 'starter').toLowerCase();
    const config = TIER_LIMITS[tierKey] || TIER_LIMITS['starter'];

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [activeCustomers, monthlyOrders, activeRiders, payments] = await Promise.all([
      prisma.customer.count({ where: { tenantId, status: 'active' } }),
      prisma.order.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { tenantId, role: { name: { contains: 'Rider' } }, status: 'active' } }),
      prisma.subscriptionPayment.findMany({ where: { tenantId }, orderBy: { paymentDate: 'desc' } })
    ]);

    const customerPct = Math.min(100, Math.round((activeCustomers / config.maxCustomers) * 100));
    const orderPct = Math.min(100, Math.round((monthlyOrders / config.maxMonthlyOrders) * 100));
    const riderPct = Math.min(100, Math.round((activeRiders / config.maxRiders) * 100));

    const totalBilled = config.priceMonthly;
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const remainingBalance = Math.max(0, totalBilled - totalPaid);
    const paymentStatus = remainingBalance === 0 ? 'PAID' : (totalPaid > 0 ? 'PARTIAL' : 'PENDING');

    let quotaWarning: string | null = null;
    if (customerPct >= 90 || orderPct >= 90 || riderPct >= 90) {
      quotaWarning = 'Warning: You are reaching 90%+ of your plan quota limits. Upgrade your tier to avoid operational blocks.';
    }

    return {
      tenantId: tenant.id,
      companyName: tenant.companyName,
      subscriptionTier: tierKey,
      tierName: config.name,
      priceMonthly: config.priceMonthly,
      financials: {
        totalBilled,
        totalPaid,
        remainingBalance,
        paymentStatus,
      },
      paymentHistory: payments,
      usage: {
        customers: { current: activeCustomers, limit: config.maxCustomers, pct: customerPct },
        orders: { current: monthlyOrders, limit: config.maxMonthlyOrders, pct: orderPct },
        riders: { current: activeRiders, limit: config.maxRiders, pct: riderPct }
      },
      quotaWarning,
      tierLimits: TIER_LIMITS
    };
  }

  /**
   * Quota Guard: Enforces resource limits before creation
   */
  async checkQuotaLimit(tenantId: string, resource: 'customer' | 'order' | 'rider') {
    const metering = await this.getTenantMetering(tenantId);
    const tierKey = metering.subscriptionTier;

    if (tierKey === 'enterprise') return true; // Unlimited enterprise plan

    if (resource === 'customer' && metering.usage.customers.current >= metering.usage.customers.limit) {
      throw new Error(`Subscription Quota Limit Reached: Your ${metering.tierName} allows a maximum of ${metering.usage.customers.limit} active customers. Please upgrade your subscription tier to continue adding accounts.`);
    }

    if (resource === 'order' && metering.usage.orders.current >= metering.usage.orders.limit) {
      throw new Error(`Subscription Quota Limit Reached: Your ${metering.tierName} allows a maximum of ${metering.usage.orders.limit} monthly orders. Please upgrade your subscription tier to continue booking orders.`);
    }

    if (resource === 'rider' && metering.usage.riders.current >= metering.usage.riders.limit) {
      throw new Error(`Subscription Quota Limit Reached: Your ${metering.tierName} allows a maximum of ${metering.usage.riders.limit} rider staff accounts. Please upgrade your subscription tier to add more riders.`);
    }

    return true;
  }

  /**
   * Upgrade or switch subscription tier for tenant
   */
  async updateSubscriptionTier(tenantId: string, newTier: string) {
    const validTiers = ['starter', 'professional', 'enterprise'];
    const tierKey = newTier.toLowerCase();

    if (!validTiers.includes(tierKey)) {
      throw new Error(`Invalid tier. Supported tiers are: ${validTiers.join(', ')}`);
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionTier: tierKey }
    });

    return this.getTenantMetering(tenantId);
  }

  /**
   * Platform Operator Overview across all subscribing tenant companies
   */
  async getAllTenantsMetering() {
    const tenants = await prisma.tenant.findMany({
      select: { id: true }
    });

    const tenantMeterings = await Promise.all(
      tenants.map(t => this.getTenantMetering(t.id))
    );

    let totalMRR = 0;
    for (const m of tenantMeterings) {
      totalMRR += m.priceMonthly;
    }

    return {
      totalSubscribers: tenantMeterings.length,
      totalMRR,
      tenantMeterings
    };
  }
}
