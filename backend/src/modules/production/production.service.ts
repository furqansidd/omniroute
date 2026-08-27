import { prisma } from '../../utils/prisma.js';

export interface RecordBatchInput {
  warehouseId: string;
  finishedProductId: string;
  bomId?: string;
  batchNumber?: string;
  industryType?: string;
  inputQty?: number;
  outputQty: number;
  laborOverheadCost?: number;
  qualityPassed?: boolean;
  tdsLevel?: number;
  phLevel?: number;
  viscosityGrade?: string;
  notes?: string;
}

export class ProductionService {
  // --- BILL OF MATERIALS (BOM / RECIPE) ---
  static async listBOMs(tenantId: string) {
    return prisma.billOfMaterials.findMany({
      where: { tenantId },
      include: {
        finishedProduct: { select: { id: true, name: true, sku: true, unit: true, price: true, costPrice: true } },
        items: {
          include: {
            rawProduct: { select: { id: true, name: true, sku: true, unit: true, costPrice: true, productType: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createBOM(tenantId: string, data: {
    finishedProductId: string;
    name: string;
    yieldQty?: number;
    items: Array<{ rawProductId: string; qtyRequired: number }>;
  }) {
    return prisma.billOfMaterials.create({
      data: {
        tenantId,
        finishedProductId: data.finishedProductId,
        name: data.name,
        yieldQty: data.yieldQty || 1.0,
        items: {
          create: data.items.map((item) => ({
            rawProductId: item.rawProductId,
            qtyRequired: item.qtyRequired
          }))
        }
      },
      include: {
        finishedProduct: true,
        items: { include: { rawProduct: true } }
      }
    });
  }

  // --- BATCH MANUFACTURING & AUTOMATED CONNECTIONS ---
  static async recordProductionBatch(tenantId: string, producedById: string, input: RecordBatchInput) {
    if (!input.warehouseId || !input.finishedProductId || !input.outputQty) {
      throw new Error('warehouseId, finishedProductId, and outputQty are required');
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: input.warehouseId, tenantId }
    });
    if (!warehouse) throw new Error('Warehouse depot not found');

    const finishedProduct = await prisma.product.findFirst({
      where: { id: input.finishedProductId, tenantId }
    });
    if (!finishedProduct) throw new Error('Finished product not found');

    // Find BOM recipe if bomId passed or find first active BOM for finished product
    let bom = null;
    if (input.bomId) {
      bom = await prisma.billOfMaterials.findFirst({
        where: { id: input.bomId, tenantId },
        include: { items: { include: { rawProduct: true } } }
      });
    } else {
      bom = await prisma.billOfMaterials.findFirst({
        where: { finishedProductId: input.finishedProductId, tenantId, status: 'active' },
        include: { items: { include: { rawProduct: true } } }
      });
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const batchNumber = input.batchNumber || `BAT-${dateStr}-${randomSuffix}`;
    const qualityPassed = input.qualityPassed !== undefined ? input.qualityPassed : true;
    const laborOverheadCost = input.laborOverheadCost || 0.0;

    return prisma.$transaction(async (tx) => {
      let totalMaterialCost = 0.0;

      // 1. If BOM recipe exists, deduct raw materials & packaging from StockLedger and calculate cost
      if (bom && bom.items.length > 0) {
        for (const bomItem of bom.items) {
          const requiredQty = (bomItem.qtyRequired / bom.yieldQty) * input.outputQty;
          const materialCost = requiredQty * (bomItem.rawProduct.costPrice || 0);
          totalMaterialCost += materialCost;

          if (qualityPassed) {
            // Deduct raw material stock
            await tx.stockLedger.create({
              data: {
                tenantId,
                productId: bomItem.rawProductId,
                warehouseId: input.warehouseId,
                qty: -Math.ceil(requiredQty),
                transactionType: 'production_consumption',
                referenceId: batchNumber
              }
            });
          }
        }
      }

      const totalBatchCost = totalMaterialCost + laborOverheadCost;
      const unitCost = input.outputQty > 0 ? totalBatchCost / input.outputQty : 0.0;

      // 2. Create Production Batch record
      const createdBatch = await tx.productionBatch.create({
        data: {
          tenantId,
          warehouseId: input.warehouseId,
          finishedProductId: input.finishedProductId,
          bomId: bom?.id || null,
          batchNumber,
          industryType: input.industryType || 'water',
          inputQty: input.inputQty || 0.0,
          outputQty: input.outputQty,
          laborOverheadCost,
          totalMaterialCost,
          unitCost,
          qualityPassed,
          tdsLevel: input.tdsLevel || null,
          phLevel: input.phLevel || null,
          viscosityGrade: input.viscosityGrade || null,
          notes: input.notes || null,
          producedById
        },
        include: {
          warehouse: true,
          finishedProduct: true,
          bom: true,
          producedBy: { select: { id: true, name: true, email: true } }
        }
      });

      // 3. Add finished product to StockLedger & update product unit cost
      if (qualityPassed) {
        await tx.stockLedger.create({
          data: {
            tenantId,
            productId: input.finishedProductId,
            warehouseId: input.warehouseId,
            qty: Math.round(input.outputQty),
            transactionType: 'production_yield',
            referenceId: createdBatch.id
          }
        });

        await tx.product.update({
          where: { id: input.finishedProductId },
          data: { costPrice: unitCost > 0 ? unitCost : finishedProduct.costPrice }
        });

        // 4. Post Financial Journal Entry
        const entryCount = await tx.journalEntry.count({ where: { tenantId } });
        const entryNumber = `JE-${(entryCount + 1).toString().padStart(6, '0')}`;

        await tx.journalEntry.create({
          data: {
            tenantId,
            entryNumber,
            description: `Production Batch ${batchNumber} (${finishedProduct.name})`,
            reference: batchNumber,
            ledgers: {
              create: [
                {
                  tenantId,
                  accountCategory: 'asset',
                  accountName: 'Finished Goods Inventory',
                  description: `Finished stock yield for ${batchNumber}`,
                  debit: totalBatchCost,
                  credit: 0.0
                },
                ...(totalMaterialCost > 0 ? [{
                  tenantId,
                  accountCategory: 'asset',
                  accountName: 'Raw Material Inventory',
                  description: `Raw materials consumed for ${batchNumber}`,
                  debit: 0.0,
                  credit: totalMaterialCost
                }] : []),
                ...(laborOverheadCost > 0 ? [{
                  tenantId,
                  accountCategory: 'expense',
                  accountName: 'Production Overhead',
                  description: `Labor & overhead for ${batchNumber}`,
                  debit: 0.0,
                  credit: laborOverheadCost
                }] : [])
              ]
            }
          }
        });
      }

      return createdBatch;
    });
  }

  static async getProductionBatches(tenantId: string, filters: { warehouseId?: string; qualityPassed?: boolean; search?: string } = {}) {
    const where: any = { tenantId };

    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.qualityPassed !== undefined) where.qualityPassed = filters.qualityPassed;
    if (filters.search) {
      where.OR = [
        { batchNumber: { contains: filters.search } },
        { finishedProduct: { name: { contains: filters.search } } }
      ];
    }

    return prisma.productionBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: true,
        finishedProduct: true,
        bom: true,
        producedBy: { select: { id: true, name: true, email: true } }
      }
    });
  }

  static async getProductionStats(tenantId: string) {
    const [totalBatches, passedBatches, totals] = await Promise.all([
      prisma.productionBatch.count({ where: { tenantId } }),
      prisma.productionBatch.count({ where: { tenantId, qualityPassed: true } }),
      prisma.productionBatch.aggregate({
        where: { tenantId },
        _sum: { outputQty: true, inputQty: true }
      })
    ]);

    const qcPassRate = totalBatches > 0 ? (passedBatches / totalBatches) * 100 : 100;

    return {
      totalBatches,
      passedBatches,
      failedBatches: totalBatches - passedBatches,
      qcPassRate: Math.round(qcPassRate * 10) / 10,
      totalUnitsProduced: totals._sum.outputQty || 0,
      totalRawInputProcessed: totals._sum.inputQty || 0
    };
  }
}
