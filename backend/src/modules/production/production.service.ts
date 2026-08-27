import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RecordBatchInput {
  warehouseId: string;
  finishedProductId: string;
  batchNumber?: string;
  industryType?: string;
  inputQty?: number;
  outputQty: number;
  qualityPassed?: boolean;
  tdsLevel?: number;
  phLevel?: number;
  viscosityGrade?: string;
  notes?: string;
}

export class ProductionService {
  /**
   * Record a manufacturing batch run & auto-post finished stock ledger entry if QC passed
   */
  async recordProductionBatch(tenantId: string, producedById: string, input: RecordBatchInput) {
    if (!input.warehouseId || !input.finishedProductId || !input.outputQty) {
      throw new Error('warehouseId, finishedProductId, and outputQty are required');
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: input.warehouseId, tenantId }
    });
    if (!warehouse) throw new Error('Warehouse depot not found');

    const product = await prisma.product.findFirst({
      where: { id: input.finishedProductId, tenantId }
    });
    if (!product) throw new Error('Finished product not found');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const batchNumber = input.batchNumber || `BAT-${dateStr}-${randomSuffix}`;

    const qualityPassed = input.qualityPassed !== undefined ? input.qualityPassed : true;

    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.productionBatch.create({
        data: {
          tenantId,
          warehouseId: input.warehouseId,
          finishedProductId: input.finishedProductId,
          batchNumber,
          industryType: input.industryType || 'water',
          inputQty: input.inputQty || 0.0,
          outputQty: input.outputQty,
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
          producedBy: { select: { id: true, name: true, email: true } }
        }
      });

      // Automatically credit finished stock in StockLedger if QC passed
      if (qualityPassed) {
        await tx.stockLedger.create({
          data: {
            tenantId,
            productId: input.finishedProductId,
            warehouseId: input.warehouseId,
            qty: Math.round(input.outputQty),
            transactionType: 'production',
            referenceId: createdBatch.id
          }
        });
      }

      return createdBatch;
    });

    return batch;
  }

  /**
   * List production batches with filter criteria
   */
  async getProductionBatches(tenantId: string, filters: { warehouseId?: string; qualityPassed?: boolean; search?: string } = {}) {
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
        producedBy: { select: { id: true, name: true, email: true } }
      }
    });
  }

  /**
   * Aggregate production KPI statistics
   */
  async getProductionStats(tenantId: string) {
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
