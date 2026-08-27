import { prisma } from '../../utils/prisma.js';

export interface CompleteDeliveryDto {
  status: 'delivered' | 'failed';
  deliveredQty?: number;
  emptiesCollectedQty?: number;
  cashCollected?: number;
  geoLat?: number;
  geoLng?: number;
  eSignatureUrl?: string;
  failureReason?: string;
}

export class DeliveryService {
  static async completeDelivery(tenantId: string, riderId: string, deliveryId: string, dto: CompleteDeliveryDto) {
    const delivery = await prisma.delivery.findFirst({
      where: { id: deliveryId, tenantId },
      include: {
        order: {
          include: {
            customer: { include: { securityLedgers: true } },
            items: { include: { product: true } }
          }
        }
      }
    });

    if (!delivery) throw new Error('Delivery record not found');

    return prisma.$transaction(async (tx) => {
      // 1. Update Delivery record
      const updatedDelivery = await tx.delivery.update({
        where: { id: deliveryId },
        data: {
          status: dto.status,
          deliveredQty: dto.deliveredQty ?? delivery.order.items.reduce((sum, i) => sum + i.qty, 0),
          emptiesCollectedQty: dto.emptiesCollectedQty ?? 0,
          cashCollected: dto.cashCollected ?? 0,
          geoLat: dto.geoLat,
          geoLng: dto.geoLng,
          eSignatureUrl: dto.eSignatureUrl,
          failureReason: dto.failureReason,
          deliveredAt: dto.status === 'delivered' ? new Date() : null
        }
      });

      if (dto.status === 'delivered') {
        // 2. Mark Order as delivered
        await tx.order.update({
          where: { id: delivery.orderId },
          data: { status: 'delivered' }
        });

        // 3. Record StockLedger item deduction
        for (const item of delivery.order.items) {
          await tx.stockLedger.create({
            data: {
              tenantId,
              productId: item.productId,
              riderId,
              qty: -Math.abs(item.qty),
              transactionType: 'deliver',
              referenceId: `DELIVERY-${delivery.id}`
            }
          });

          // If item is returnable container, update customer security ledger
          if (item.product.isReturnableContainer) {
            const existingLedger = delivery.order.customer.securityLedgers.find(
              l => l.productId === item.productId
            );

            const netQtyChange = item.qty - (dto.emptiesCollectedQty || 0);

            if (existingLedger) {
              await tx.customerSecurityLedger.update({
                where: { id: existingLedger.id },
                data: {
                  qtyHeld: Math.max(0, existingLedger.qtyHeld + netQtyChange)
                }
              });
            } else if (netQtyChange > 0) {
              await tx.customerSecurityLedger.create({
                data: {
                  tenantId,
                  customerId: delivery.order.customerId,
                  productId: item.productId,
                  qtyHeld: netQtyChange,
                  depositAmount: item.product.price * netQtyChange
                }
              });
            }
          }
        }

        // 4. Record returned empties in StockLedger if collected
        if (dto.emptiesCollectedQty && dto.emptiesCollectedQty > 0) {
          const containerItem = delivery.order.items.find(i => i.product.isReturnableContainer);
          if (containerItem) {
            await tx.stockLedger.create({
              data: {
                tenantId,
                productId: containerItem.productId,
                riderId,
                qty: dto.emptiesCollectedQty,
                transactionType: 'return',
                referenceId: `EMPTIES-DELIVERY-${delivery.id}`
              }
            });
          }
        }

        // 5. Create PaymentVoucher if cash collected
        if (dto.cashCollected && dto.cashCollected > 0) {
          const count = await tx.paymentVoucher.count({ where: { tenantId } });
          const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const voucherNumber = `VCH-${todayStr}-${(count + 1).toString().padStart(3, '0')}`;

          await tx.paymentVoucher.create({
            data: {
              tenantId,
              customerId: delivery.order.customerId,
              riderId,
              voucherNumber,
              voucherType: 'receipt',
              category: 'rider_route_collection',
              amount: dto.cashCollected,
              paymentMethod: 'cash',
              notes: `Route cash collected by rider on delivery ${delivery.order.orderNumber}`
            }
          });
        }
      } else if (dto.status === 'failed') {
        await tx.order.update({
          where: { id: delivery.orderId },
          data: { status: 'failed' }
        });
      }

      return updatedDelivery;
    }, { timeout: 30000 });
  }

  static async listDeliveries(tenantId: string, query: { status?: string; riderId?: string }) {
    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.riderId) where.riderId = query.riderId;

    return prisma.delivery.findMany({
      where,
      include: {
        order: {
          include: {
            customer: true,
            items: { include: { product: true } }
          }
        },
        rider: { select: { id: true, name: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
