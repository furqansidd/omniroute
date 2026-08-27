import { prisma } from '../../utils/prisma.js';
import { SaasService } from '../saas/saas.service.js';

const saasService = new SaasService();

export interface CreateCustomerDto {
  name: string;
  phone: string;
  email?: string;
  address: string;
  zoneId?: string;
  geoLat?: number;
  geoLng?: number;
  stopNumber?: number;
  customerType?: 'residential' | 'commercial' | 'corporate';
  status?: 'active' | 'sleeping' | 'churned';
}

export interface UpdateCustomerDto {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  zoneId?: string;
  geoLat?: number;
  geoLng?: number;
  stopNumber?: number;
  customerType?: 'residential' | 'commercial' | 'corporate';
  status?: 'active' | 'sleeping' | 'churned';
}

export class CustomerService {
  static async list(tenantId: string, query: {
    search?: string;
    zoneId?: string;
    customerType?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { phone: { contains: query.search } },
        { email: { contains: query.search } },
        { address: { contains: query.search } }
      ];
    }

    if (query.zoneId) where.zoneId = query.zoneId;
    if (query.customerType) where.customerType = query.customerType;
    if (query.status) where.status = query.status;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          zone: true,
          securityLedgers: {
            include: { product: true }
          },
          _count: { select: { orders: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.customer.count({ where })
    ]);

    return {
      customers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getById(tenantId: string, id: string) {
    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        zone: true,
        productRates: {
          include: { product: true }
        },
        securityLedgers: {
          include: { product: true }
        },
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { delivery: true }
        }
      }
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return customer;
  }

  static async create(tenantId: string, dto: CreateCustomerDto) {
    await saasService.checkQuotaLimit(tenantId, 'customer');
    return prisma.customer.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        zoneId: dto.zoneId,
        geoLat: dto.geoLat,
        geoLng: dto.geoLng,
        stopNumber: dto.stopNumber,
        customerType: dto.customerType || 'residential',
        status: dto.status || 'active'
      },
      include: { zone: true }
    });
  }

  static async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    // Verify existence under tenant
    const existing = await prisma.customer.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error('Customer not found');
    }

    return prisma.customer.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address && { address: dto.address }),
        ...(dto.zoneId !== undefined && { zoneId: dto.zoneId }),
        ...(dto.geoLat !== undefined && { geoLat: dto.geoLat }),
        ...(dto.geoLng !== undefined && { geoLng: dto.geoLng }),
        ...(dto.stopNumber !== undefined && { stopNumber: dto.stopNumber }),
        ...(dto.customerType && { customerType: dto.customerType }),
        ...(dto.status && { status: dto.status })
      },
      include: { zone: true }
    });
  }

  static async setCustomRate(tenantId: string, customerId: string, productId: string, customPrice: number) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new Error('Customer not found');

    const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new Error('Product not found');

    return prisma.customerProductRate.upsert({
      where: {
        customerId_productId: { customerId, productId }
      },
      update: { customPrice },
      create: {
        tenantId,
        customerId,
        productId,
        customPrice
      },
      include: { product: true }
    });
  }

  static async adjustSecurityDeposit(
    tenantId: string,
    customerId: string,
    productId: string,
    qtyChange: number,
    depositChange: number
  ) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new Error('Customer not found');

    const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product || !product.isReturnableContainer) {
      throw new Error('Product must be a valid returnable container asset (bottle/cylinder)');
    }

    const existing = await prisma.customerSecurityLedger.findUnique({
      where: { customerId_productId: { customerId, productId } }
    });

    const newQty = Math.max(0, (existing?.qtyHeld || 0) + qtyChange);
    const newDeposit = Math.max(0, (existing?.depositAmount || 0) + depositChange);

    return prisma.customerSecurityLedger.upsert({
      where: { customerId_productId: { customerId, productId } },
      update: {
        qtyHeld: newQty,
        depositAmount: newDeposit
      },
      create: {
        tenantId,
        customerId,
        productId,
        qtyHeld: Math.max(0, qtyChange),
        depositAmount: Math.max(0, depositChange)
      },
      include: { product: true }
    });
  }

  static async delete(tenantId: string, id: string) {
    const customer = await prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) throw new Error('Customer not found');

    const orders = await prisma.order.findMany({ where: { customerId: id, tenantId } });
    for (const order of orders) {
      await prisma.delivery.deleteMany({ where: { orderId: order.id } });
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }

    const invoices = await prisma.invoice.findMany({ where: { customerId: id, tenantId } });
    for (const inv of invoices) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });
      await prisma.invoice.delete({ where: { id: inv.id } });
    }

    await prisma.customerProductRate.deleteMany({ where: { customerId: id } });
    await prisma.customerSecurityLedger.deleteMany({ where: { customerId: id } });
    await prisma.ledger.deleteMany({ where: { customerId: id } });
    await prisma.paymentVoucher.deleteMany({ where: { customerId: id } });
    await prisma.recurringSchedule.deleteMany({ where: { customerId: id } });

    return prisma.customer.delete({ where: { id } });
  }
}

