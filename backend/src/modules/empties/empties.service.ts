import { prisma } from '../../utils/prisma.js';

export interface AdjustDepositDto {
  customerId: string;
  productId: string;
  deltaQty: number; // positive = customer took more containers, negative = customer returned containers
  depositAmountChange?: number;
  reason?: string;
}

export class EmptiesService {
  static async getEmptiesSummary(tenantId: string) {
    const ledgers = await prisma.customerSecurityLedger.findMany({
      where: { tenantId },
      include: { product: true }
    });

    let totalContainersHeld = 0;
    let totalDepositValueHeld = 0;

    for (const l of ledgers) {
      totalContainersHeld += l.qtyHeld;
      totalDepositValueHeld += l.depositAmount;
    }

    const totalReturnsLogged = await prisma.stockLedger.aggregate({
      where: { tenantId, transactionType: 'return' },
      _sum: { qty: true }
    });

    return {
      totalContainersHeld,
      totalDepositValueHeld,
      totalReturnsLogged: totalReturnsLogged._sum.qty || 0,
      activeLedgerCount: ledgers.length
    };
  }

  static async getEmptiesLedger(tenantId: string, query: { customerId?: string; productId?: string; search?: string }) {
    const where: any = { tenantId };
    if (query.customerId) where.customerId = query.customerId;
    if (query.productId) where.productId = query.productId;

    if (query.search) {
      where.customer = {
        OR: [
          { name: { contains: query.search } },
          { phone: { contains: query.search } }
        ]
      };
    }

    return prisma.customerSecurityLedger.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, address: true, zone: true } },
        product: true
      },
      orderBy: { qtyHeld: 'desc' }
    });
  }

  static async adjustContainerDeposit(tenantId: string, dto: AdjustDepositDto) {
    const customer = await prisma.customer.findFirst({ where: { id: dto.customerId, tenantId } });
    if (!customer) throw new Error('Customer not found');

    const product = await prisma.product.findFirst({ where: { id: dto.productId, tenantId } });
    if (!product) throw new Error('Product not found');

    return prisma.$transaction(async (tx) => {
      const existingLedger = await tx.customerSecurityLedger.findFirst({
        where: { tenantId, customerId: dto.customerId, productId: dto.productId }
      });

      let updatedLedger;
      if (existingLedger) {
        const newQty = Math.max(0, existingLedger.qtyHeld + dto.deltaQty);
        const newDeposit = Math.max(0, existingLedger.depositAmount + (dto.depositAmountChange ?? (dto.deltaQty * product.price)));

        updatedLedger = await tx.customerSecurityLedger.update({
          where: { id: existingLedger.id },
          data: {
            qtyHeld: newQty,
            depositAmount: newDeposit
          },
          include: { customer: true, product: true }
        });
      } else {
        const initialQty = Math.max(0, dto.deltaQty);
        const initialDeposit = Math.max(0, dto.depositAmountChange ?? (initialQty * product.price));

        updatedLedger = await tx.customerSecurityLedger.create({
          data: {
            tenantId,
            customerId: dto.customerId,
            productId: dto.productId,
            qtyHeld: initialQty,
            depositAmount: initialDeposit
          },
          include: { customer: true, product: true }
        });
      }

      // Record StockLedger audit entry for return or issue
      const txType = dto.deltaQty < 0 ? 'return' : 'load';
      await tx.stockLedger.create({
        data: {
          tenantId,
          productId: dto.productId,
          qty: Math.abs(dto.deltaQty),
          transactionType: txType,
          referenceId: `CONTAINER-ADJUST-${Date.now()}`
        }
      });

      return updatedLedger;
    });
  }
}
