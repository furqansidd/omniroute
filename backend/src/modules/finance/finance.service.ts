import { prisma } from '../../utils/prisma.js';

export interface CreateVoucherInput {
  voucherType: 'receipt' | 'payment' | 'debit_note' | 'credit_note';
  category?: string;
  amount: number;
  customerId?: string;
  vendorId?: string;
  riderId?: string;
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
  riderId?: string;
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
          riderId: input.riderId || null,
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
          vendor: { select: { id: true, name: true, phone: true } },
          rider: { select: { id: true, name: true, phone: true } }
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

      if (category === 'rider_collection_handover') {
        debitAccountName = 'Cash & Bank';
        debitCategory = 'asset';
        creditAccountName = 'Rider Cash Transit Wallet';
        creditCategory = 'asset';
      } else if (voucherType === 'receipt') {
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
          riderId: input.riderId || null,
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
          riderId: input.riderId || null,
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
    }, { timeout: 30000 });
  }

  async getVouchers(tenantId: string, query: GetVouchersQuery = {}) {
    const { voucherType, category, customerId, vendorId, riderId, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (voucherType) where.voucherType = voucherType;
    if (category) where.category = category;
    if (customerId) where.customerId = customerId;
    if (vendorId) where.vendorId = vendorId;
    if (riderId) where.riderId = riderId;

    if (search) {
      where.OR = [
        { voucherNumber: { contains: search } },
        { referenceNumber: { contains: search } },
        { notes: { contains: search } },
        { customer: { name: { contains: search } } },
        { vendor: { name: { contains: search } } },
        { rider: { name: { contains: search } } }
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
          vendor: { select: { id: true, name: true, phone: true } },
          rider: { select: { id: true, name: true, phone: true } }
        }
      }),
      prisma.paymentVoucher.count({ where })
    ]);

    return { vouchers, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ----------------------------------------------------
  // RIDER CASH HOLDING & SETTLEMENT LOGIC
  // ----------------------------------------------------
  async getRiderCashHoldings(tenantId: string) {
    // Fetch all riders (users with role containing 'rider' or users with deliveries)
    const riders = await prisma.user.findMany({
      where: {
        tenantId,
        status: 'active'
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true
      }
    });

    const riderHoldings = await Promise.all(
      riders.map(async (rider) => {
        const [deliveries, handovers] = await Promise.all([
          prisma.delivery.findMany({
            where: {
              tenantId,
              riderId: rider.id,
              status: 'delivered'
            },
            select: { cashCollected: true, id: true, deliveredAt: true }
          }),
          prisma.paymentVoucher.findMany({
            where: {
              tenantId,
              riderId: rider.id,
              category: 'rider_collection_handover'
            },
            select: { amount: true, id: true, createdAt: true }
          })
        ]);

        const totalCollected = deliveries.reduce((sum, d) => sum + (d.cashCollected || 0), 0);
        const totalHandedOver = handovers.reduce((sum, h) => sum + h.amount, 0);
        const netCashHeld = Math.max(0, totalCollected - totalHandedOver);

        return {
          id: rider.id,
          name: rider.name,
          phone: rider.phone,
          email: rider.email,
          deliveryCount: deliveries.length,
          totalCollected,
          totalHandedOver,
          netCashHeld
        };
      })
    );

    // Only return riders who have deliveries or cash held
    const activeRiderHoldings = riderHoldings.filter(r => r.deliveryCount > 0 || r.totalCollected > 0 || r.totalHandedOver > 0);
    const totalRiderCashHeld = activeRiderHoldings.reduce((sum, r) => sum + r.netCashHeld, 0);

    return {
      totalRiderCashHeld,
      riders: activeRiderHoldings.length > 0 ? activeRiderHoldings : riderHoldings
    };
  }

  async settleRiderCashHandover(tenantId: string, input: { riderId: string; amount: number; paymentMethod?: string; notes?: string }) {
    if (!input.amount || input.amount <= 0) {
      throw new Error('Handover amount must be greater than zero');
    }

    const rider = await prisma.user.findFirst({ where: { id: input.riderId, tenantId } });
    if (!rider) throw new Error('Rider not found');

    return this.createVoucher(tenantId, {
      voucherType: 'receipt',
      category: 'rider_collection_handover',
      riderId: input.riderId,
      amount: input.amount,
      paymentMethod: input.paymentMethod || 'cash',
      accountName: 'Cash & Bank',
      notes: input.notes || `Cash handover received from rider ${rider.name}`
    });
  }

  // ----------------------------------------------------
  // VENDOR STATEMENT LEDGER
  // ----------------------------------------------------
  async getVendorLedger(tenantId: string, vendorId: string) {
    const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, tenantId } });
    if (!vendor) throw new Error('Vendor not found');

    const [purchaseOrders, vouchers] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: { tenantId, vendorId, status: { in: ['received_full', 'received_partial', 'issued'] } },
        include: { goodsReceipts: true },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.paymentVoucher.findMany({
        where: { tenantId, vendorId },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    const timeline: any[] = [];
    for (const po of purchaseOrders) {
      timeline.push({
        id: po.id,
        date: po.createdAt,
        type: 'PO_BILL',
        reference: po.poNumber,
        description: `PO Bill ${po.poNumber} (${po.goodsReceipts.length} GRN received)`,
        debit: 0.0,
        credit: po.totalAmount
      });
    }

    for (const vch of vouchers) {
      if (vch.voucherType === 'payment') {
        timeline.push({
          id: vch.id,
          date: vch.createdAt,
          type: 'VENDOR_PAYOUT',
          reference: vch.voucherNumber,
          description: `Payout to Vendor (${vch.paymentMethod.toUpperCase()}) - ${vch.notes || 'Payment'}`,
          debit: vch.amount,
          credit: 0.0
        });
      }
    }

    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runningBalance = 0.0;
    const transactions = timeline.map(tx => {
      runningBalance += (tx.credit - tx.debit);
      return { ...tx, balance: runningBalance };
    });

    return {
      vendor: { id: vendor.id, name: vendor.name, phone: vendor.phone, email: vendor.email, address: vendor.address },
      totalBilled: purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0),
      totalPaid: vouchers.filter(v => v.voucherType === 'payment').reduce((sum, v) => sum + v.amount, 0),
      balancePayable: vendor.balancePayable,
      transactions
    };
  }

  // ----------------------------------------------------
  // RIDER CASH STATEMENT LEDGER
  // ----------------------------------------------------
  async getRiderStatementLedger(tenantId: string, riderId: string) {
    const rider = await prisma.user.findFirst({ where: { id: riderId, tenantId } });
    if (!rider) throw new Error('Rider not found');

    const [deliveries, handovers] = await Promise.all([
      prisma.delivery.findMany({
        where: { tenantId, riderId, status: 'delivered' },
        include: { order: { include: { customer: selectCustomer() } } },
        orderBy: { deliveredAt: 'asc' }
      }),
      prisma.paymentVoucher.findMany({
        where: { tenantId, riderId, category: 'rider_collection_handover' },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    const timeline: any[] = [];
    for (const d of deliveries) {
      if (d.cashCollected && d.cashCollected > 0) {
        timeline.push({
          id: d.id,
          date: d.deliveredAt || d.createdAt,
          type: 'CASH_COLLECTION',
          reference: d.order?.orderNumber || 'DELIVERY',
          description: `Collected cash from ${d.order?.customer?.name || 'Customer'}`,
          debit: d.cashCollected,
          credit: 0.0
        });
      }
    }

    for (const vch of handovers) {
      timeline.push({
        id: vch.id,
        date: vch.createdAt,
        type: 'ADMIN_HANDOVER',
        reference: vch.voucherNumber,
        description: `Handed over cash to Admin (${vch.paymentMethod.toUpperCase()}) - ${vch.notes || 'Handover'}`,
        debit: 0.0,
        credit: vch.amount
      });
    }

    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runningBalance = 0.0;
    const transactions = timeline.map(tx => {
      runningBalance += (tx.debit - tx.credit);
      return { ...tx, balance: runningBalance };
    });

    return {
      rider: { id: rider.id, name: rider.name, phone: rider.phone, email: rider.email },
      totalCollected: deliveries.reduce((sum, d) => sum + (d.cashCollected || 0), 0),
      totalHandedOver: handovers.reduce((sum, h) => sum + h.amount, 0),
      netCashHeld: runningBalance,
      transactions
    };
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
        include: { ledgers: { include: { customer: { select: { name: true } }, vendor: { select: { name: true } }, rider: { select: { name: true } } } } }
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
    const [invoices, vendors, receipts, payments, riderData] = await Promise.all([
      prisma.invoice.findMany({ where: { tenantId, status: { in: ['unpaid', 'partial'] } } }),
      prisma.vendor.findMany({ where: { tenantId } }),
      prisma.paymentVoucher.findMany({ where: { tenantId, voucherType: 'receipt' } }),
      prisma.paymentVoucher.findMany({ where: { tenantId, voucherType: 'payment' } }),
      this.getRiderCashHoldings(tenantId)
    ]);

    const totalReceivables = invoices.reduce((sum, i) => sum + (i.totalAmount - i.paidAmount), 0);
    const totalVendorPayables = vendors.reduce((sum, v) => sum + v.balancePayable, 0);
    const totalRiderCashHeld = riderData.totalRiderCashHeld;

    // Admin Cash & Bank: ONLY count cash received by Admin (Handovers from riders & direct admin receipts) MINUS Payouts
    const adminHandovers = receipts.filter(r => r.category === 'rider_collection_handover');
    const directAdminReceipts = receipts.filter(r => r.category !== 'rider_route_collection' && r.category !== 'rider_collection_handover');

    const totalCashInAdminHand = adminHandovers.reduce((sum, r) => sum + r.amount, 0) + directAdminReceipts.reduce((sum, r) => sum + r.amount, 0);
    const cashPaidOut = payments.reduce((sum, p) => sum + p.amount, 0);
    const adminCashBalance = totalCashInAdminHand - cashPaidOut;

    return {
      totalReceivables,
      totalVendorPayables,
      totalRiderCashHeld,
      adminCashBalance,
      netProfit: totalCashInAdminHand - cashPaidOut
    };
  }
}

function selectCustomer() {
  return { select: { id: true, name: true, phone: true } };
}
