import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface LogBreakageInput {
  productId: string;
  warehouseId?: string;
  qty: number;
  unitCost?: number;
  reason: 'bottle_damage' | 'milk_spoilage' | 'oil_spill' | 'cylinder_leak' | 'expired' | 'transport_loss' | string;
  liabilityType?: 'company' | 'rider';
  responsibleRiderId?: string;
  notes?: string;
}

export interface GetBreakageQuery {
  reason?: string;
  liabilityType?: string;
  productId?: string;
  warehouseId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class BreakageService {
  /**
   * Log a new breakage, spoilage, or wastage incident and post negative inventory adjustment
   */
  async logBreakageWastage(tenantId: string, reportedById: string, input: LogBreakageInput) {
    if (!input.productId || !input.qty || input.qty <= 0) {
      throw new Error('productId and valid positive qty are required');
    }

    const product = await prisma.product.findFirst({
      where: { id: input.productId, tenantId }
    });
    if (!product) throw new Error('Product not found');

    const unitCost = input.unitCost !== undefined ? Number(input.unitCost) : product.unitPrice;
    const totalCost = Number((input.qty * unitCost).toFixed(2));
    const liabilityType = input.liabilityType || 'company';

    const log = await prisma.breakageWastageLog.create({
      data: {
        tenantId,
        productId: input.productId,
        warehouseId: input.warehouseId || null,
        qty: Number(input.qty),
        unitCost,
        totalCost,
        reason: input.reason || 'bottle_damage',
        liabilityType,
        responsibleRiderId: input.responsibleRiderId || null,
        reportedById,
        notes: input.notes || null
      },
      include: {
        product: true,
        warehouse: true,
        reportedBy: { select: { id: true, name: true, phone: true } },
        responsibleRider: { select: { id: true, name: true, phone: true } }
      }
    });

    // Record negative stock adjustment in StockLedger
    const stockLedger = await prisma.stockLedger.create({
      data: {
        tenantId,
        productId: input.productId,
        warehouseId: input.warehouseId || null,
        riderId: input.responsibleRiderId || null,
        qty: -Math.abs(Number(input.qty)), // negative adjustment
        transactionType: 'breakage',
        referenceId: log.id
      }
    });

    return {
      log,
      stockLedger
    };
  }

  /**
   * Get breakage audit logs with filtering and search
   */
  async getBreakageLogs(tenantId: string, query: GetBreakageQuery = {}) {
    const { reason, liabilityType, productId, warehouseId, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (reason) where.reason = reason;
    if (liabilityType) where.liabilityType = liabilityType;
    if (productId) where.productId = productId;
    if (warehouseId) where.warehouseId = warehouseId;

    if (search) {
      where.OR = [
        { product: { name: { contains: search } } },
        { notes: { contains: search } }
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.breakageWastageLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          warehouse: true,
          reportedBy: { select: { id: true, name: true, phone: true } },
          responsibleRider: { select: { id: true, name: true, phone: true } }
        }
      }),
      prisma.breakageWastageLog.count({ where })
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get financial cost and unit KPI statistics for breakage & wastage
   */
  async getBreakageStats(tenantId: string) {
    const logs = await prisma.breakageWastageLog.findMany({
      where: { tenantId }
    });

    let totalQtyLost = 0;
    let totalCostImpact = 0;
    let companyAbsorptionCost = 0;
    let riderLiabilityCost = 0;

    const breakdownByReason: Record<string, { qty: number; cost: number }> = {
      bottle_damage: { qty: 0, cost: 0 },
      milk_spoilage: { qty: 0, cost: 0 },
      oil_spill: { qty: 0, cost: 0 },
      cylinder_leak: { qty: 0, cost: 0 },
      expired: { qty: 0, cost: 0 },
      transport_loss: { qty: 0, cost: 0 }
    };

    for (const log of logs) {
      totalQtyLost += log.qty;
      totalCostImpact += log.totalCost;

      if (log.liabilityType === 'rider') {
        riderLiabilityCost += log.totalCost;
      } else {
        companyAbsorptionCost += log.totalCost;
      }

      const r = log.reason || 'other';
      if (!breakdownByReason[r]) {
        breakdownByReason[r] = { qty: 0, cost: 0 };
      }
      breakdownByReason[r].qty += log.qty;
      breakdownByReason[r].cost += log.totalCost;
    }

    return {
      totalQtyLost,
      totalCostImpact: Number(totalCostImpact.toFixed(2)),
      companyAbsorptionCost: Number(companyAbsorptionCost.toFixed(2)),
      riderLiabilityCost: Number(riderLiabilityCost.toFixed(2)),
      breakdownByReason
    };
  }
}
