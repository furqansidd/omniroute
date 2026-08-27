import { prisma } from '../../utils/prisma.js';

export class PurchaseService {
  // --- VENDORS ---
  static async listVendors(tenantId: string) {
    return prisma.vendor.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { purchaseOrders: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createVendor(tenantId: string, data: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxId?: string;
    paymentTerms?: string;
  }) {
    return prisma.vendor.create({
      data: {
        tenantId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        taxId: data.taxId,
        paymentTerms: data.paymentTerms || 'net_30',
        balancePayable: 0.0
      }
    });
  }

  static async getVendorById(tenantId: string, vendorId: string) {
    return prisma.vendor.findFirst({
      where: { id: vendorId, tenantId },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        paymentVouchers: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        ledgers: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });
  }

  // --- PURCHASE ORDERS ---
  static async listPurchaseOrders(tenantId: string) {
    return prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: {
        vendor: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } }
          }
        },
        goodsReceipts: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createPurchaseOrder(tenantId: string, data: {
    vendorId: string;
    expectedDeliveryDate?: string;
    notes?: string;
    items: Array<{ productId: string; expectedQty: number; unitPrice: number }>;
  }) {
    const poCount = await prisma.purchaseOrder.count({ where: { tenantId } });
    const poNumber = `PO-${(poCount + 1).toString().padStart(5, '0')}`;

    let totalAmount = 0;
    const itemsData = data.items.map((item) => {
      const lineTotal = item.expectedQty * item.unitPrice;
      totalAmount += lineTotal;
      return {
        productId: item.productId,
        expectedQty: item.expectedQty,
        unitPrice: item.unitPrice,
        totalPrice: lineTotal
      };
    });

    return prisma.purchaseOrder.create({
      data: {
        tenantId,
        vendorId: data.vendorId,
        poNumber,
        status: 'issued',
        totalAmount,
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        notes: data.notes,
        items: {
          create: itemsData
        }
      },
      include: {
        vendor: true,
        items: { include: { product: true } }
      }
    });
  }

  // --- GOODS RECEIVED NOTE (GRN) & AUTOMATED CONNECTIONS ---
  static async createGoodsReceipt(tenantId: string, userId: string, data: {
    poId: string;
    warehouseId?: string;
    notes?: string;
    items: Array<{
      productId: string;
      expectedQty: number;
      receivedQty: number;
      unitCost: number;
    }>;
  }) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: data.poId, tenantId },
      include: { vendor: true }
    });

    if (!po) {
      throw new Error('Purchase Order not found');
    }

    const grnCount = await prisma.goodsReceipt.count({ where: { tenantId } });
    const grnNumber = `GRN-${(grnCount + 1).toString().padStart(5, '0')}`;

    let totalReceivedCost = 0;

    // Use transaction for atomic execution across Stock, Wastage, Vendor Balance, and Finance
    return prisma.$transaction(async (tx) => {
      // 1. Create Goods Receipt record
      const grn = await tx.goodsReceipt.create({
        data: {
          tenantId,
          poId: data.poId,
          grnNumber,
          notes: data.notes,
          items: {
            create: data.items.map((item) => {
              const lineCost = item.receivedQty * item.unitCost;
              const rejectedQty = Math.max(0, item.expectedQty - item.receivedQty);
              totalReceivedCost += lineCost;
              return {
                productId: item.productId,
                expectedQty: item.expectedQty,
                receivedQty: item.receivedQty,
                rejectedQty,
                unitCost: item.unitCost,
                totalCost: lineCost
              };
            })
          }
        },
        include: { items: { include: { product: true } } }
      });

      // 2. Process stock increase & cost update & wastage for each item
      for (const item of data.items) {
        if (item.receivedQty > 0) {
          // Increase stock ledger
          await tx.stockLedger.create({
            data: {
              tenantId,
              productId: item.productId,
              warehouseId: data.warehouseId || null,
              qty: item.receivedQty,
              transactionType: 'purchase_receipt',
              referenceId: grnNumber
            }
          });

          // Update product latest cost price
          await tx.product.update({
            where: { id: item.productId },
            data: { costPrice: item.unitCost }
          });
        }

        // Check for receiving shortage/loss
        const shortageQty = Math.max(0, item.expectedQty - item.receivedQty);
        if (shortageQty > 0) {
          await tx.breakageWastageLog.create({
            data: {
              tenantId,
              productId: item.productId,
              warehouseId: data.warehouseId || null,
              qty: shortageQty,
              unitCost: item.unitCost,
              totalCost: shortageQty * item.unitCost,
              reason: 'supplier_shortage',
              liabilityType: 'company',
              reportedById: userId,
              notes: `Receiving shortage on ${grnNumber} for PO ${po.poNumber}`
            }
          });
        }
      }

      // 3. Update Vendor Payable Balance
      await tx.vendor.update({
        where: { id: po.vendorId },
        data: {
          balancePayable: { increment: totalReceivedCost }
        }
      });

      // 4. Update PO status
      const allFullyReceived = data.items.every((i) => i.receivedQty >= i.expectedQty);
      await tx.purchaseOrder.update({
        where: { id: data.poId },
        data: {
          status: allFullyReceived ? 'received_full' : 'received_partial'
        }
      });

      // 5. Automatic Financial Entry (Double Entry Ledger)
      const entryCount = await tx.journalEntry.count({ where: { tenantId } });
      const entryNumber = `JE-${(entryCount + 1).toString().padStart(6, '0')}`;

      const journalEntry = await tx.journalEntry.create({
        data: {
          tenantId,
          entryNumber,
          description: `Purchase Receipt ${grnNumber} from ${po.vendor.name}`,
          reference: grnNumber,
          ledgers: {
            create: [
              {
                tenantId,
                accountCategory: 'asset',
                accountName: 'Inventory Asset',
                description: `Received goods for ${grnNumber}`,
                debit: totalReceivedCost,
                credit: 0.0
              },
              {
                tenantId,
                vendorId: po.vendorId,
                accountCategory: 'liability',
                accountName: 'Accounts Payable',
                description: `Payable to ${po.vendor.name} for ${grnNumber}`,
                debit: 0.0,
                credit: totalReceivedCost
              }
            ]
          }
        }
      });

      return { grn, totalReceivedCost, journalEntry };
    }, { timeout: 30000 });
  }
}
