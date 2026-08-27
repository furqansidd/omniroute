import { prisma } from '../../utils/prisma.js';

export interface CreateVoucherInput {
  voucherType: 'receipt' | 'payment' | 'debit_note' | 'credit_note';
  category?: string;
  amount: number;
  customerId?: string;
  vendorId?: string;
  paymentMethod?: string;
  accountName?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface GetVouchersQuery {
  voucherType?: string;
  category?: string;
  customerId?: string;
  vendorId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class FinanceService {
  private async getNextVoucherNumber(tenantId: string): Promise<string> {
    const count = await prisma.paymentVoucher.count({ where: { tenantId } });
    const nextNum = (count + 1).toString().padStart(5, '0');
    return `VCH-${nextNum}`;
  }

  private async getNextEntryNumber(tenantId: string): Promise<string> {
    const count = await prisma.journalEntry.count({ where: { tenantId } });
    const nextNum = (count + 1).toString().padStart(5, '0');
    return `JE-${nextNum}`;
  }

  async createVoucher(tenantId: string, input: CreateVoucherInput) {
    if (!input.amount || input.amount <= 0) {
      throw new Error('Voucher amount must be greater than zero');
    }

    const voucherNumber = await this.getNextVoucherNumber(tenantId);
    const entryNumber = await this.getNextEntryNumber(tenantId);
    const voucherType = input.voucherType || 'receipt';
    const category = input.category || (input.vendorId ? 'supplier_payment' : voucherType === 'receipt' ? 'customer_collection' : 'other');

    return prisma.$transaction(async (tx) => {
      // 1. Create PaymentVoucher
      const voucher = await tx.paymentVoucher.create({
        data: {
          tenantId,
          customerId: input.customerId || null,
          vendorId: input.vendorId || null,
          voucherNumber,
          voucherType,
          category,
          accountName: input.accountName || (voucherType === 'receipt' ? 'Cash & Bank' : input.vendorId ? 'Accounts Payable' : 'Operating Expense'),
          amount: input.amount,
          paymentMethod: input.paymentMethod || 'cash',
          referenceNumber: input.referenceNumber || null,
          notes: input.notes || null
        },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          vendor: { select: { id: true, name: true, phone: true } }
        }
      });

      // If paying vendor, decrement vendor balancePayable
      if (input.vendorId && voucherType === 'payment') {
        await tx.vendor.update({
          where: { id: input.vendorId },
          data: { balancePayable: { decrement: input.amount } }
        });
      }

      // 2. Post Double-Entry Journal Entry
      const description = `${voucherType.toUpperCase()}: ${input.notes || category} (${voucherNumber})`;
      const journalEntry = await tx.journalEntry.create({
        data: {
          tenantId,
          entryNumber,
          description,
          reference: voucherNumber
        }
      });

      let debitAccountName = 'Cash & Bank';
      let debitCategory = 'asset';
      let creditAccountName = 'Accounts Receivable';
      let creditCategory = 'asset';

      if (voucherType === 'receipt') {
        debitAccountName = input.accountName || 'Cash & Bank';
        debitCategory = 'asset';
        creditAccountName = 'Accounts Receivable';
        creditCategory = 'asset';
      } else if (voucherType === 'payment') {
        if (input.vendorId) {
          debitAccountName = 'Accounts Payable';
          debitCategory = 'liability';
          creditAccountName = input.accountName || 'Cash & Bank';
          creditCategory = 'asset';
        } else {
          debitAccountName = input.accountName || 'Operating Expense';
          debitCategory = 'expense';
          creditAccountName = 'Cash & Bank';
          creditCategory = 'asset';
        }
      } else if (voucherType === 'credit_note') {
        debitAccountName = 'Sales Discounts & Allowances';
        debitCategory = 'expense';
        creditAccountName = 'Accounts Receivable';
        creditCategory = 'asset';
      } else if (voucherType === 'debit_note') {
        debitAccountName = 'Accounts Receivable';
        debitCategory = 'asset';
        creditAccountName = 'Miscellaneous Income';
        creditCategory = 'revenue';
      }

      await tx.ledger.create({
        data: {
          tenantId,
          customerId: input.customerId || null,
          vendorId: input.vendorId || null,
          journalEntryId: journalEntry.id,
          accountCategory: debitCategory,
          accountName: debitAccountName,
          description: `Debit: ${description}`,
          debit: input.amount,
          credit: 0.0,
          runningBalance: input.amount
        }
      });

      await tx.ledger.create({
        data: {
          tenantId,
          customerId: input.customerId || null,
          vendorId: input.vendorId || null,
          journalEntryId: journalEntry.id,
          accountCategory: creditCategory,
          accountName: creditAccountName,
          description: `Credit: ${description}`,
          debit: 0.0,
          credit: input.amount,
          runningBalance: -input.amount
        }
      });

      // Auto-apply payment to invoices if customer receipt
      if (input.customerId && (voucherType === 'receipt' || voucherType === 'credit_note')) {
        let remainingToApply = input.amount;
        const unpaidInvoices = await tx.invoice.findMany({
          where: {
            tenantId,
            customerId: input.customerId,
            status: { in: ['unpaid', 'partial'] }
          },
          orderBy: { createdAt: 'asc' }
        });

        for (const inv of unpaidInvoices) {
          if (remainingToApply <= 0) break;
          const due = inv.totalAmount - inv.paidAmount;
          const applyAmt = Math.min(due, remainingToApply);
          const newPaid = inv.paidAmount + applyAmt;
          const newStatus = newPaid >= inv.totalAmount ? 'paid' : 'partial';

          await tx.invoice.update({
            where: { id: inv.id },
            data: { paidAmount: newPaid, status: newStatus }
          });

          remainingToApply -= applyAmt;
        }
      }

      return { voucher, journalEntry };
    });
  }

  async getVouchers(tenantId: string, query: GetVouchersQuery = {}) {
    const { voucherType, category, customerId, vendorId, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (voucherType) where.voucherType = voucherType;
    if (category) where.category = category;
    if (customerId) where.customerId = customerId;
    if (vendorId) where.vendorId = vendorId;

    if (search) {
      where.OR = [
        { voucherNumber: { contains: search } },
        { referenceNumber: { contains: search } },
        { notes: { contains: search } },
        { customer: { name: { contains: search } } },
        { vendor: { name: { contains: search } } }
      ];
    }

    const [vouchers, total] = await Promise.all([
      prisma.paymentVoucher.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          vendor: { select: { id: true, name: true, phone: true } }
        }
      }),
      prisma.paymentVoucher.count({ where })
    ]);

    return { vouchers, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCustomerStatementLedger(tenantId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new Error('Customer not found');

    const [invoices, vouchers] = await Promise.all([
      prisma.invoice.findMany({ where: { tenantId, customerId, status: { not: 'cancelled' } }, orderBy: { createdAt: 'asc' } }),
      prisma.paymentVoucher.findMany({ where: { tenantId, customerId }, orderBy: { createdAt: 'asc' } })
    ]);

    const timeline: any[] = [];
    for (const inv of invoices) {
      timeline.push({ id: inv.id, date: inv.createdAt, type: 'INVOICE', reference: inv.invoiceNumber, description: `Invoice ${inv.billingPeriod}`, debit: inv.totalAmount, credit: 0.0 });
    }
    for (const vch of vouchers) {
      if (vch.voucherType === 'receipt' || vch.voucherType === 'credit_note') {
        timeline.push({ id: vch.id, date: vch.createdAt, type: vch.voucherType.toUpperCase(), reference: vch.voucherNumber, description: `${vch.paymentMethod.toUpperCase()} Collection (${vch.notes || 'Payment'})`, debit: 0.0, credit: vch.amount });
      } else if (vch.voucherType === 'debit_note') {
        timeline.push({ id: vch.id, date: vch.createdAt, type: 'DEBIT_NOTE', reference: vch.voucherNumber, description: vch.notes || 'Additional Charge', debit: vch.amount, credit: 0.0 });
      }
    }

    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runningBalance = 0.0;
    const transactions = timeline.map(tx => {
      runningBalance += (tx.debit - tx.credit);
      return { ...tx, balance: runningBalance };
    });

    return {
      customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, address: customer.address },
      totalInvoiced: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      totalPaid: vouchers.filter(v => v.voucherType === 'receipt').reduce((sum, v) => sum + v.amount, 0),
      netBalance: runningBalance,
      transactions
    };
  }

  async getGeneralLedger(tenantId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { ledgers: { include: { customer: { select: { name: true } }, vendor: { select: { name: true } } } } }
      }),
      prisma.journalEntry.count({ where: { tenantId } })
    ]);

    return { entries, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPnLReport(tenantId: string, startDate?: string, endDate?: string) {
    const invoiceWhere: any = { tenantId, status: { not: 'cancelled' } };
    const voucherWhere: any = { tenantId, voucherType: 'payment' };
    const breakageWhere: any = { tenantId };

    if (startDate && endDate) {
      invoiceWhere.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
      voucherWhere.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
      breakageWhere.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const invoices = await prisma.invoice.findMany({ where: invoiceWhere });
    const grossSalesRevenue = invoices.reduce((sum, i) => sum + i.totalAmount, 0);

    const expenseVouchers = await prisma.paymentVoucher.findMany({ where: voucherWhere });
    const expenseBreakdown: Record<string, number> = {};
    let totalOperatingExpenses = 0;

    for (const exp of expenseVouchers) {
      const cat = exp.category || 'other';
      expenseBreakdown[cat] = (expenseBreakdown[cat] || 0) + exp.amount;
      totalOperatingExpenses += exp.amount;
    }

    const breakageLogs = await prisma.breakageWastageLog.findMany({ where: breakageWhere, include: { product: true } });
    const totalWastageCost = breakageLogs.reduce((sum, b) => sum + b.totalCost, 0);

    const netProfit = grossSalesRevenue - (totalOperatingExpenses + totalWastageCost);

    return {
      period: startDate && endDate ? `${startDate} to ${endDate}` : 'All Time',
      revenue: { grossSales: grossSalesRevenue, totalRevenue: grossSalesRevenue },
      operatingExpenses: { total: totalOperatingExpenses, breakdown: expenseBreakdown },
      wastageCost: totalWastageCost,
      netProfit,
      isProfitable: netProfit >= 0
    };
  }

  async getFinancialOverview(tenantId: string) {
    const [invoices, vendors, receipts, payments] = await Promise.all([
      prisma.invoice.findMany({ where: { tenantId, status: { in: ['unpaid', 'partial'] } } }),
      prisma.vendor.findMany({ where: { tenantId } }),
      prisma.paymentVoucher.findMany({ where: { tenantId, voucherType: 'receipt' } }),
      prisma.paymentVoucher.findMany({ where: { tenantId, voucherType: 'payment' } })
    ]);

    const totalReceivables = invoices.reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);
    const totalVendorPayables = vendors.reduce((sum, v) => sum + v.balancePayable, 0);
    const cashCollected = receipts.reduce((sum, r) => sum + r.amount, 0);
    const cashPaidOut = payments.reduce((sum, p) => sum + p.amount, 0);
    const cashBalance = cashCollected - cashPaidOut;

    return {
      totalReceivables,
      totalVendorPayables,
      cashBalance,
      netProfit: cashCollected - cashPaidOut
    };
  }
}
