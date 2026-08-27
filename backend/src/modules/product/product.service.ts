import { prisma } from '../../utils/prisma.js';

export interface CreateProductDto {
  name: string;
  sku: string;
  category: string;
  unit?: string;
  price: number;
  isReturnableContainer?: boolean;
  serialTrackingRequired?: boolean;
}

export interface UpdateProductDto {
  name?: string;
  category?: string;
  unit?: string;
  price?: number;
  isReturnableContainer?: boolean;
  serialTrackingRequired?: boolean;
}

export interface CreateWarehouseDto {
  name: string;
  location?: string;
  isRiderMobileDepot?: boolean;
  riderId?: string;
}

export interface StockMovementDto {
  productId: string;
  warehouseId?: string;
  riderId?: string;
  qty: number;
  transactionType: 'load' | 'deliver' | 'return' | 'breakage' | 'wastage' | 'transfer';
  referenceId?: string;
}

export class ProductService {
  static async listProducts(tenantId: string, query: { search?: string; category?: string; isReturnable?: boolean }) {
    const where: any = { tenantId };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { sku: { contains: query.search } }
      ];
    }
    if (query.category) where.category = query.category;
    if (query.isReturnable !== undefined) where.isReturnableContainer = String(query.isReturnable) === 'true';

    return prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createProduct(tenantId: string, dto: CreateProductDto) {
    const existing = await prisma.product.findFirst({
      where: { tenantId, sku: dto.sku }
    });
    if (existing) {
      throw new Error(`A product with SKU "${dto.sku}" already exists in your catalog`);
    }

    return prisma.product.create({
      data: {
        tenantId,
        name: dto.name,
        sku: dto.sku,
        category: dto.category,
        unit: dto.unit || 'unit',
        price: dto.price,
        isReturnableContainer: dto.isReturnableContainer || false,
        serialTrackingRequired: dto.serialTrackingRequired || false
      }
    });
  }

  static async updateProduct(tenantId: string, id: string, dto: UpdateProductDto) {
    const existing = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error('Product not found');

    return prisma.product.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.category && { category: dto.category }),
        ...(dto.unit && { unit: dto.unit }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.isReturnableContainer !== undefined && { isReturnableContainer: dto.isReturnableContainer }),
        ...(dto.serialTrackingRequired !== undefined && { serialTrackingRequired: dto.serialTrackingRequired })
      }
    });
  }

  static async listWarehouses(tenantId: string) {
    return prisma.warehouse.findMany({
      where: { tenantId },
      include: {
        rider: { select: { id: true, name: true, phone: true } },
        _count: { select: { stockLedgers: true } }
      },
      orderBy: { name: 'asc' }
    });
  }

  static async createWarehouse(tenantId: string, dto: CreateWarehouseDto) {
    return prisma.warehouse.create({
      data: {
        tenantId,
        name: dto.name,
        location: dto.location,
        isRiderMobileDepot: dto.isRiderMobileDepot || false,
        riderId: dto.riderId
      },
      include: { rider: true }
    });
  }

  static async getStockLevels(tenantId: string, warehouseId?: string) {
    const where: any = { tenantId };
    if (warehouseId) where.warehouseId = warehouseId;

    const ledgers = await prisma.stockLedger.findMany({
      where,
      include: { product: true, warehouse: true }
    });

    // Group running balance by product & warehouse
    const summaryMap: Record<string, { product: any; warehouse: any; currentQty: number }> = {};

    for (const entry of ledgers) {
      const key = `${entry.productId}:${entry.warehouseId || 'no-wh'}`;
      if (!summaryMap[key]) {
        summaryMap[key] = {
          product: entry.product,
          warehouse: entry.warehouse,
          currentQty: 0
        };
      }

      // Add or subtract based on transaction type
      if (['load', 'return', 'transfer'].includes(entry.transactionType)) {
        summaryMap[key].currentQty += entry.qty;
      } else if (['deliver', 'breakage', 'wastage'].includes(entry.transactionType)) {
        summaryMap[key].currentQty -= entry.qty;
      }
    }

    return Object.values(summaryMap);
  }

  static async recordStockMovement(tenantId: string, dto: StockMovementDto) {
    const product = await prisma.product.findFirst({ where: { id: dto.productId, tenantId } });
    if (!product) throw new Error('Product not found');

    return prisma.stockLedger.create({
      data: {
        tenantId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        riderId: dto.riderId,
        qty: dto.qty,
        transactionType: dto.transactionType,
        referenceId: dto.referenceId || `MANUAL-${Date.now()}`
      },
      include: { product: true, warehouse: true }
    });
  }
}
