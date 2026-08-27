import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateVoucherInput {
  voucherType: 'receipt' | 'payment' | 'debit_note' | 'credit_note';
  category?: string;
  amount: number;
  customerId?: string;
  paymentMethod?: string;
  accountName?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface GetVouchersQuery {
  voucherType?: string;
  category?: string;
  customerId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class FinanceService {
  /**
   * Helper to format next voucher number with prefix VCH-
   */
  private async getNextVoucherNumber(tenantId: string): Promise<string> {
    const count = await prisma.paymentVoucher.count({
      where: { tenantId }
    });
    const nextNum = (count + 1).toString().padStart(5, '0');
    return `VCH-${nextNum}`;
  }

  /**
   * Helper to format next journal entry number JE-
   */
  private async getNextEntryNumber(tenantId: string): Promise<string> {
    const count = await prisma.journalEntry.count({
      where: { tenantId }
    });
    const nextNum = (count + 1).toString().padStart(5, '0');
    return `JE-${nextNum}`;
  }

  /**
   * Create financial voucher and post balanced double-entry journal entries
   */
  async createVoucher(tenantId: string, input: CreateVoucherInput) {
    if (!input.amount || input.amount <= 0) {
      throw new Error('Voucher amount must be greater than zero');
    }

    const voucherNumber = await this.getNextVoucherNumber(tenantId);
    const entryNumber = await this.getNextEntryNumber(tenantId);
    const voucherType = input.voucherType || 'receipt';
    const category = input.category || (voucherType === 'receipt' ? 'customer_collection' : 'other');

    // 1. Create PaymentVoucher
    const voucher = await prisma.paymentVoucher.create({
      data: {
        tenantId,
        customerId: input.customerId || null,
        voucherNumber,
        voucherType,
        category,
        accountName: input.accountName || (voucherType === 'receipt' ? 'Cash & Bank' : 'Operating Expense'),
        amount: input.amount,
        paymentMethod: input.paymentMethod || 'cash',
        referenceNumber: input.referenceNumber || null,
        notes: input.notes || null
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true }
        }
      }
    });

    // 2. Post Double-Entry Journal Entry
    const description = `${voucherType.toUpperCase()}: ${input.notes || category} (${voucherNumber})`;
    const journalEntry = await prisma.journalEntry.create({
      data: {
        tenantId,
        entryNumber,
        description,
        reference: voucherNumber
      }
    });

    // Determine balanced debit & credit line items based on voucher type
    let debitAccountName = 'Cash & Bank';
    let debitCategory = 'asset';
    let creditAccountName = 'Accounts Receivable';
    let creditCategory = 'asset';

    if (voucherType === 'receipt') {
      // Customer payment collection
      debitAccountName = input.accountName || 'Cash & Bank';
      debitCategory = 'asset';
      creditAccountName = 'Accounts Receivable';
      creditCategory = 'asset';
    } else if (voucherType === 'payment') {
      // Operating Expense payout
      debitAccountName = input.accountName || 'Operating Expense';
      debitCategory = 'expense';
      creditAccountName = 'Cash & Bank';
      creditCategory = 'asset';
    } else if (voucherType === 'credit_note') {
      // Adjustment / Discount to customer
      debitAccountName = 'Sales Discounts & Allowances';
      debitCategory = 'expense';
      creditAccountName = 'Accounts Receivable';
      creditCategory = 'asset';
    } else if (voucherType === 'debit_note') {
      // Charge / Penalty to customer
      debitAccountName = 'Accounts Receivable';
      debitCategory = 'asset';
      creditAccountName = 'Miscellaneous Income';
      creditCategory = 'revenue';
    }

    // Post Debit Ledger
    await prisma.ledger.create({
      data: {
        tenantId,
        customerId: input.customerId || null,
        journalEntryId: journalEntry.id,
        accountCategory: debitCategory,
        accountName: debitAccountName,
        description: `Debit: ${description}`,
        debit: input.amount,
        credit: 0.0,
        runningBalance: input.amount
      }
    });

    // Post Credit Ledger
    await prisma.ledger.create({
      data: {
        tenantId,
        customerId: input.customerId || null,
        journalEntryId: journalEntry.id,
        accountCategory: creditCategory,
        accountName: creditAccountName,
        description: `Credit: ${description}`,
        debit: 0.0,
        credit: input.amount,
        runningBalance: -input.amount
      }
    });

    // 3. If customer voucher and receipt, auto-apply payment to outstanding unpaid invoices
    if (input.customerId && (voucherType === 'receipt' || voucherType === 'credit_note')) {
      let remainingToApply = input.amount;
      const unpaidInvoices = await prisma.invoice.findMany({
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

        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: newPaid,
            status: newStatus
          }
        });

        remainingToApply -= applyAmt;
      }
    }

    return {
      voucher,
      journalEntry
    };
  }

  /**
   * List vouchers with filters and search
   */
  async getVouchers(tenantId: string, query: GetVouchersQuery = {}) {
    const { voucherType, category, customerId, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (voucherType) where.voucherType = voucherType;
    if (category) where.category = category;
    if (customerId) where.customerId = customerId;

    if (search) {
      where.OR = [
        { voucherNumber: { contains: search } },
        { referenceNumber: { contains: search } },
        { notes: { contains: search } },
        { customer: { name: { contains: search } } }
      ];
    }

    const [vouchers, total] = await Promise.all([
      prisma.paymentVoucher.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } }
        }
      }),
      prisma.paymentVoucher.count({ where })
    ]);

    return {
      vouchers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get Customer Statement Ledger with running balance
   */
  async getCustomerStatementLedger(tenantId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId }
    });
    if (!customer) throw new Error('Customer not found');

    const [invoices, vouchers] = await Promise.all([
      prisma.invoice.findMany({
        where: { tenantId, customerId, status: { not: 'cancelled' } },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.paymentVoucher.findMany({
        where: { tenantId, customerId },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    // Build timeline of events
    const timeline: any[] = [];

    for (const inv of invoices) {
      timeline.push({
        id: inv.id,
        date: inv.createdAt,
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        description: `Invoice ${inv.billingPeriod}`,
        debit: inv.totalAmount,  // Charge increases balance
        credit: 0.0
      });
    }

    for (const vch of vouchers) {
      if (vch.voucherType === 'receipt' || vch.voucherType === 'credit_note') {
        timeline.push({
          id: vch.id,
          date: vch.createdAt,
          type: vch.voucherType.toUpperCase(),
          reference: vch.voucherNumber,
          description: `${vch.paymentMethod.toUpperCase()} Payment (${vch.notes || 'Collection'})`,
          debit: 0.0,
          credit: vch.amount // Collection reduces balance
        });
      } else if (vch.voucherType === 'debit_note') {
        timeline.push({
          id: vch.id,
          date: vch.createdAt,
          type: 'DEBIT_NOTE',
          reference: vch.voucherNumber,
          description: vch.notes || 'Additional Charge',
          debit: vch.amount,
          credit: 0.0
        });
      }
    }

    // Sort by date
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute running balance
    let runningBalance = 0.0;
    const transactions = timeline.map(tx => {
      runningBalance += (tx.debit - tx.credit);
      return {
        ...tx,
        balance: runningBalance
      };
    });

    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalPaid = vouchers
      .filter(v => v.voucherType === 'receipt')
      .reduce((sum, v) => sum + v.amount, 0);
    const totalAdjustments = vouchers
      .filter(v => v.voucherType === 'credit_note')
      .reduce((sum, v) => sum + v.amount, 0);

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address
      },
      totalInvoiced,
      totalPaid,
      totalAdjustments,
      netBalance: runningBalance,
      transactions
    };
  }

  /**
   * Get General Ledger log
   */
  async getGeneralLedger(tenantId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ledgers: true
        }
      }),
      prisma.journalEntry.count({ where: { tenantId } })
    ]);

    return { entries, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Profit & Loss (P&L) Statement Report
   */
  async getPnLReport(tenantId: string, startDate?: string, endDate?: string) {
    const invoiceWhere: any = { tenantId, status: { not: 'cancelled' } };
    const voucherWhere: any = { tenantId, voucherType: 'payment' };
    const breakageWhere: any = { tenantId };

    if (startDate && endDate) {
      invoiceWhere.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
      voucherWhere.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
      breakageWhere.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    // 1. Total Sales Revenue from Invoices
    const invoices = await prisma.invoice.findMany({ where: invoiceWhere });
    const grossSalesRevenue = invoices.reduce((sum, i) => sum + i.totalAmount, 0);

    // 2. Operating Expenses from Payment Vouchers (Fuel, Salaries, Suppliers, Equipment)
    const expenseVouchers = await prisma.paymentVoucher.findMany({ where: voucherWhere });
    
    const expenseBreakdown: Record<string, number> = {};
    let totalOperatingExpenses = 0;

    for (const exp of expenseVouchers) {
      const cat = exp.category || 'other';
      expenseBreakdown[cat] = (expenseBreakdown[cat] || 0) + exp.amount;
      totalOperatingExpenses += exp.amount;
    }

    // 3. Spoilage / Wastage Costs
    const breakageLogs = await prisma.breakageWastageLog.findMany({
      where: breakageWhere,
      include: { product: true }
    });
    const totalWastageCost = breakageLogs.reduce((sum, b) => sum + (b.qty * (b.product?.price || 0)), 0);

    // Net Operating Income / Profit
    const netProfit = grossSalesRevenue - (totalOperatingExpenses + totalWastageCost);

    return {
      period: startDate && endDate ? `${startDate} to ${endDate}` : 'All Time',
      revenue: {
        grossSales: grossSalesRevenue,
        totalRevenue: grossSalesRevenue
      },
      operatingExpenses: {
        total: totalOperatingExpenses,
        breakdown: expenseBreakdown
      },
      wastageCost: totalWastageCost,
      netProfit,
      isProfitable: netProfit >= 0
    };
  }

  /**
   * Balance Sheet Statement Report
   */
  async getBalanceSheetReport(tenantId: string, asOfDate?: string) {
    const whereDate = asOfDate ? { lte: new Date(asOfDate) } : undefined;

    // Assets:
    // 1. Cash & Bank Balances = Total Receipts - Total Payment Vouchers
    const receipts = await prisma.paymentVoucher.findMany({
      where: { tenantId, voucherType: 'receipt', createdAt: whereDate }
    });
    const payments = await prisma.paymentVoucher.findMany({
      where: { tenantId, voucherType: 'payment', createdAt: whereDate }
    });
    const cashCollected = receipts.reduce((sum, r) => sum + r.amount, 0);
    const cashPaidOut = payments.reduce((sum, p) => sum + p.amount, 0);
    const cashAndBankBalance = Math.max(0, cashCollected - cashPaidOut);

    // 2. Accounts Receivable = Sum of unpaid balance on active invoices
    const invoices = await prisma.invoice.findMany({
      where: { tenantId, status: { in: ['unpaid', 'partial'] }, createdAt: whereDate }
    });
    const accountsReceivable = invoices.reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);

    // 3. Returnable Container Security Deposit Liabilities
    const securityLedgers = await prisma.customerSecurityLedger.findMany({
      where: { tenantId }
    });
    const customerDepositLiability = securityLedgers.reduce((sum, s) => sum + s.depositAmount, 0);

    const totalAssets = cashAndBankBalance + accountsReceivable;
    const totalLiabilities = customerDepositLiability;
    const equity = totalAssets - totalLiabilities;

    return {
      asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
      assets: {
        cashAndBank: cashAndBankBalance,
        accountsReceivable,
        totalAssets
      },
      liabilities: {
        customerContainerDeposits: customerDepositLiability,
        totalLiabilities
      },
      equity: {
        retainedEarnings: equity,
        totalEquity: equity
      },
      balanced: Math.abs(totalAssets - (totalLiabilities + equity)) < 0.01
    };
  }
}
