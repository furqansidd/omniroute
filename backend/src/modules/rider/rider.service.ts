import { prisma } from '../../utils/prisma.js';

export class RiderService {
  static async getTodayRoute(tenantId: string, riderId: string) {
    const today = new Date();
    const dayOfWeek = today.getDay();

    // Fetch active visit plans for this rider for today
    const visitPlans = await prisma.visitPlan.findMany({
      where: {
        tenantId,
        riderId,
        dayOfWeek,
        status: 'active'
      },
      include: {
        route: {
          include: {
            zone: true
          }
        }
      }
    });

    const routeIds = visitPlans.map(vp => vp.routeId);

    // Fetch today's deliveries assigned to rider
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const deliveries = await prisma.delivery.findMany({
      where: {
        tenantId,
        riderId,
        createdAt: { gte: startOfDay, lte: endOfDay }
      },
      include: {
        order: {
          include: {
            customer: {
              include: {
                securityLedgers: { include: { product: true } },
                productRates: true,
                invoices: {
                  where: { status: { in: ['unpaid', 'partial', 'overdue'] } }
                }
              }
            },
            items: { include: { product: true } }
          }
        }
      },
      orderBy: { order: { customer: { stopNumber: 'asc' } } }
    });

    // Also fetch pending orders for rider's route customers if no explicit delivery record generated yet
    const pendingOrders = await prisma.order.findMany({
      where: {
        tenantId,
        status: 'pending',
        delivery: { is: null },
        customer: {
          zone: {
            routes: {
              some: { id: { in: routeIds } }
            }
          }
        }
      }
    });

    // Auto-dispatch pending zone orders to the assigned rider
    for (const pending of pendingOrders) {
      await prisma.delivery.create({
        data: {
          tenantId,
          orderId: pending.id,
          riderId,
          scheduledDate: new Date(),
          status: 'pending'
        }
      });
      await prisma.order.update({
        where: { id: pending.id },
        data: { status: 'assigned' }
      });
    }

    // Re-fetch all deliveries for today including freshly dispatched
    const allDeliveries = await prisma.delivery.findMany({
      where: {
        tenantId,
        riderId,
        createdAt: { gte: startOfDay, lte: endOfDay }
      },
      include: {
        order: {
          include: {
            customer: {
              include: {
                securityLedgers: { include: { product: true } },
                productRates: true,
                invoices: {
                  where: { status: { in: ['unpaid', 'partial', 'overdue'] } }
                }
              }
            },
            items: { include: { product: true } }
          }
        }
      },
      orderBy: { order: { customer: { stopNumber: 'asc' } } }
    });

    return {
      date: new Date().toISOString(),
      dayOfWeek,
      visitPlans: visitPlans.map(vp => ({
        id: vp.id,
        routeName: vp.route.name,
        zoneName: vp.route.zone.name,
        sequenceOrder: vp.route.sequenceOrder,
        scheduleType: vp.scheduleType
      })),
      assignedDeliveries: allDeliveries.map(d => ({
        deliveryId: d.id,
        orderId: d.order.id,
        orderNumber: d.order.orderNumber,
        status: d.status,
        customer: {
          id: d.order.customer.id,
          name: d.order.customer.name,
          phone: d.order.customer.phone,
          address: d.order.customer.address,
          geoLat: d.order.customer.geoLat,
          geoLng: d.order.customer.geoLng,
          stopNumber: d.order.customer.stopNumber,
          outstandingBalance: d.order.customer.invoices?.reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0) || 0,
          containersHeld: d.order.customer.securityLedgers.map(l => ({
            productName: l.product.name,
            qtyHeld: l.qtyHeld,
            depositAmount: l.depositAmount
          }))
        },
        items: d.order.items.map(i => ({
          productId: i.productId,
          productName: i.product.name,
          sku: i.product.sku,
          qty: i.qty,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
          isReturnableContainer: i.product.isReturnableContainer
        })),
        totalAmount: d.order.totalAmount
      })),
      pendingRouteOrders: pendingOrders.map(o => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer.name,
        address: o.customer.address,
        totalAmount: o.totalAmount
      }))
    };
  }

  static async getCustomerDetails(tenantId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        zone: true,
        productRates: { include: { product: true } },
        securityLedgers: { include: { product: true } },
        invoices: { where: { status: { in: ['unpaid', 'partial', 'overdue'] } } },
        orders: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: { delivery: true, items: { include: { product: true } } }
        }
      }
    });
    if (!customer) throw new Error('Customer not found');
    return customer;
  }
}
