import { prisma } from '../../utils/prisma.js';
import { SaasService } from '../saas/saas.service.js';

const saasService = new SaasService();

export interface CreateOrderItemDto {
  productId: string;
  qty: number;
}

export interface CreateOrderDto {
  customerId: string;
  orderType?: 'scheduled' | 'on_demand' | 'recurring_subscription';
  riderId?: string;
  items: CreateOrderItemDto[];
}

export interface CreateScheduleDto {
  customerId: string;
  productId: string;
  qty?: number;
  frequency: string; // 'daily' | 'alternate_day' | 'weekly' | 'monthly' | 'days:1,3,5'
  startDate?: string;
}

export class OrderService {
  static async listOrders(tenantId: string, query: {
    status?: string;
    customerId?: string;
    orderType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.orderType) where.orderType = query.orderType;

    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search } },
        { customer: { name: { contains: query.search } } },
        { delivery: { rider: { name: { contains: query.search } } } }
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: true,
          items: { include: { product: true } },
          delivery: { include: { rider: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.order.count({ where })
    ]);

    return {
      orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getOrderById(tenantId: string, id: string) {
    const order = await prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        items: { include: { product: true } },
        delivery: { include: { rider: true } }
      }
    });

    if (!order) throw new Error('Order not found');
    return order;
  }

  static async createOrder(tenantId: string, dto: CreateOrderDto) {
    await saasService.checkQuotaLimit(tenantId, 'order');
    const customer = await prisma.customer.findFirst({ where: { id: dto.customerId, tenantId } });
    if (!customer) throw new Error('Customer not found');

    if (!dto.items || dto.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // Fetch custom rates for this customer
    const customRates = await prisma.customerProductRate.findMany({
      where: { tenantId, customerId: dto.customerId }
    });
    const customRateMap = new Map(customRates.map(r => [r.productId, r.customPrice]));

    // Generate unique order number: ORD-YYYYMMDD-XXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.order.count({ where: { tenantId } });
    const orderNumber = `ORD-${todayStr}-${(count + 1).toString().padStart(3, '0')}`;

    // Process items and calculate totals
    let totalAmount = 0;
    const itemsData = [];

    for (const item of dto.items) {
      const product = await prisma.product.findFirst({ where: { id: item.productId, tenantId } });
      if (!product) throw new Error(`Product ID ${item.productId} not found`);

      // Resolve custom price or fallback to standard product price
      const unitPrice = customRateMap.get(item.productId) ?? product.price;
      const totalPrice = unitPrice * item.qty;
      totalAmount += totalPrice;

      itemsData.push({
        productId: item.productId,
        qty: item.qty,
        unitPrice,
        totalPrice
      });
    }

    // Create Order with Items in a transaction
    return prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          orderNumber,
          orderType: dto.orderType || 'on_demand',
          status: dto.riderId ? 'assigned' : 'pending',
          totalAmount,
          items: { create: itemsData }
        },
        include: {
          customer: true,
          items: { include: { product: true } }
        }
      });

      // If rider assigned, create Delivery record
      if (dto.riderId) {
        await tx.delivery.create({
          data: {
            tenantId,
            orderId: createdOrder.id,
            riderId: dto.riderId,
            scheduledDate: new Date(),
            status: 'pending'
          }
        });
      }

      return tx.order.findUnique({
        where: { id: createdOrder.id },
        include: {
          customer: true,
          items: { include: { product: true } },
          delivery: { include: { rider: true } }
        }
      });
    });
  }

  static async updateOrderStatus(tenantId: string, orderId: string, status: string, riderId?: string) {
    const existing = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { delivery: true }
    });
    if (!existing) throw new Error('Order not found');

    return prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status }
      });

      // If assigning rider, create or update Delivery record
      if (riderId) {
        if (existing.delivery) {
          await tx.delivery.update({
            where: { id: existing.delivery.id },
            data: { riderId }
          });
        } else {
          await tx.delivery.create({
            data: {
              tenantId,
              orderId,
              riderId,
              scheduledDate: new Date(),
              status: 'pending'
            }
          });
        }
      }

      return updatedOrder;
    });
  }

  static async listSchedules(tenantId: string, query: { customerId?: string; status?: string }) {
    const where: any = { tenantId };
    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;

    return prisma.recurringSchedule.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, address: true, zone: true } },
        product: true
      },
      orderBy: { nextRunDate: 'asc' }
    });
  }

  static async createSchedule(tenantId: string, dto: CreateScheduleDto) {
    const customer = await prisma.customer.findFirst({ where: { id: dto.customerId, tenantId } });
    if (!customer) throw new Error('Customer not found');

    const product = await prisma.product.findFirst({ where: { id: dto.productId, tenantId } });
    if (!product) throw new Error('Product not found');

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();

    return prisma.recurringSchedule.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        productId: dto.productId,
        qty: dto.qty || 1,
        frequency: dto.frequency,
        nextRunDate: startDate,
        status: 'active'
      },
      include: { customer: true, product: true }
    });
  }

  static async updateScheduleStatus(tenantId: string, scheduleId: string, status: string) {
    const schedule = await prisma.recurringSchedule.findFirst({ where: { id: scheduleId, tenantId } });
    if (!schedule) throw new Error('Recurring schedule not found');

    return prisma.recurringSchedule.update({
      where: { id: scheduleId },
      data: { status }
    });
  }

  static async generateDailyRuns(tenantId: string, targetDateStr?: string) {
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    const dayOfWeek = targetDate.getDay();

    // Fetch active recurring schedules due on or before targetDate
    const dueSchedules = await prisma.recurringSchedule.findMany({
      where: {
        tenantId,
        status: 'active',
        nextRunDate: { lte: targetDate }
      },
      include: {
        customer: true,
        product: true
      }
    });

    let generatedOrdersCount = 0;

    for (const sched of dueSchedules) {
      // Find assigned rider from VisitPlan for customer's zone route
      let assignedRiderId: string | undefined;
      if (sched.customer.zoneId) {
        const route = await prisma.route.findFirst({
          where: { tenantId, zoneId: sched.customer.zoneId }
        });
        if (route) {
          const visitPlan = await prisma.visitPlan.findFirst({
            where: { tenantId, routeId: route.id, dayOfWeek }
          });
          if (visitPlan) {
            assignedRiderId = visitPlan.riderId;
          }
        }
      }

      // Create order for subscription run
      await OrderService.createOrder(tenantId, {
        customerId: sched.customerId,
        orderType: 'recurring_subscription',
        riderId: assignedRiderId,
        items: [{ productId: sched.productId, qty: sched.qty }]
      });

      generatedOrdersCount++;

      // Advance nextRunDate based on frequency
      const nextDate = new Date(sched.nextRunDate);
      if (sched.frequency === 'daily') {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (sched.frequency === 'alternate_day') {
        nextDate.setDate(nextDate.getDate() + 2);
      } else if (sched.frequency.startsWith('days:')) {
        const targetDays = sched.frequency.replace('days:', '').split(',').map(Number).filter(n => !isNaN(n));
        let found = false;
        for (let i = 1; i <= 7; i++) {
          const checkDate = new Date(sched.nextRunDate);
          checkDate.setDate(checkDate.getDate() + i);
          if (targetDays.includes(checkDate.getDay())) {
            nextDate.setTime(checkDate.getTime());
            found = true;
            break;
          }
        }
        if (!found) nextDate.setDate(nextDate.getDate() + 7);
      } else if (sched.frequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (sched.frequency === 'monthly') {
        nextDate.setDate(nextDate.getDate() + 30);
      } else {
        nextDate.setDate(nextDate.getDate() + 1);
      }

      await prisma.recurringSchedule.update({
        where: { id: sched.id },
        data: { nextRunDate: nextDate }
      });
    }

    return {
      targetDate: targetDate.toISOString(),
      schedulesProcessed: dueSchedules.length,
      generatedOrdersCount
    };
  }
}
