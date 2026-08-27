import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface BatchBillingOptions {
  billingPeriod?: string; // e.g. "2026-08"
  customerId?: string;
  startDate?: string;
  endDate?: string;
  dueDateDays?: number;
}

export interface ManualInvoiceInput {
  customerId: string;
  billingPeriod: string;
  dueDate?: string;
  notes?: string;
  items: {
    productId?: string;
    description: string;
    qty: number;
    unitPrice: number;
  }[];
}

export interface GetInvoicesQuery {
  customerId?: string;
  status?: string;
  billingPeriod?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class BillingService {
  /**
   * Helper to format next invoice number with prefix
   */
  private async getNextInvoiceNumber(tenantId: string): Promise<string> {
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });
    const prefix = settings?.invoicePrefix || 'INV-';

    const count = await prisma.invoice.count({
      where: { tenantId }
    });

    const nextNum = (count + 1).toString().padStart(5, '0');
    return `${prefix}${nextNum}`;
  }

  /**
   * Generate batch invoices for tenant customers based on delivered orders and recurring schedules
   */
  async generateBatchInvoices(tenantId: string, options: BatchBillingOptions = {}) {
    const period = options.billingPeriod || new Date().toISOString().slice(0, 7); // YYYY-MM
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });
    const taxRate = settings?.taxRate || 0.0;
    const dueDateDays = options.dueDateDays || 15;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDateDays);

    // Fetch target customers
    const customerWhere: any = { tenantId, status: 'active' };
    if (options.customerId) {
      customerWhere.id = options.customerId;
    }
    const customers = await prisma.customer.findMany({
      where: customerWhere,
      include: {
        productRates: true,
        recurringSchedules: {
          where: { status: 'active' },
          include: { product: true }
        }
      }
    });

    const createdInvoices = [];
    let totalInvoicedAmount = 0;

    for (const customer of customers) {
      // Check if invoice already exists for this customer in this billing period
      const existingInvoice = await prisma.invoice.findFirst({
        where: {
          tenantId,
          customerId: customer.id,
          billingPeriod: period,
          status: { not: 'cancelled' }
        }
      });
      if (existingInvoice) {
        continue; // Skip if already invoiced for period
      }

      // Collect delivered orders for customer that are not invoiced
      const deliveredOrders = await prisma.order.findMany({
        where: {
          tenantId,
          customerId: customer.id,
          status: 'delivered'
        },
        include: {
          items: {
            include: { product: true }
          }
        }
      });

      const lineItems: { productId?: string; description: string; qty: number; unitPrice: number; totalPrice: number }[] = [];

      if (deliveredOrders.length > 0) {
        for (const order of deliveredOrders) {
          for (const item of order.items) {
            lineItems.push({
              productId: item.productId,
              description: `${item.product?.name || 'Product'} (Order #${order.orderNumber})`,
              qty: item.qty,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice
            });
          }
        }
      } else if (customer.recurringSchedules.length > 0) {
        // Build items from recurring subscriptions if no explicit delivered orders found
        for (const sched of customer.recurringSchedules) {
          // Check for custom rate
          const customRate = customer.productRates.find(r => r.productId === sched.productId);
          const unitPrice = customRate ? customRate.customPrice : sched.product.price;
          const qty = sched.qty;
          const totalPrice = qty * unitPrice;

          lineItems.push({
            productId: sched.productId,
            description: `${sched.product.name} (${sched.frequency.toUpperCase()} Subscription)`,
            qty,
            unitPrice,
            totalPrice
          });
        }
      }

      // Skip if no billable line items exist
      if (lineItems.length === 0) continue;

      const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount;
      const invoiceNumber = await this.getNextInvoiceNumber(tenantId);

      const invoice = await prisma.invoice.create({
        data: {
          tenantId,
          customerId: customer.id,
          invoiceNumber,
          billingPeriod: period,
          subtotal,
          taxAmount,
          totalAmount,
          paidAmount: 0.0,
          status: 'unpaid',
          dueDate,
          notes: `Automated billing run for period ${period}`,
          items: {
            create: lineItems.map(item => ({
              productId: item.productId,
              description: item.description,
              qty: item.qty,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice
            }))
          }
        },
        include: {
          customer: {
            select: { id: true, name: true, phone: true, email: true }
          },
          items: true
        }
      });

      createdInvoices.push(invoice);
      totalInvoicedAmount += totalAmount;
    }

    return {
      success: true,
      billingPeriod: period,
      generatedCount: createdInvoices.length,
      totalInvoicedAmount,
      invoices: createdInvoices
    };
  }

  /**
   * Create a manual invoice for a specific customer
   */
  async createManualInvoice(tenantId: string, data: ManualInvoiceInput) {
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });
    const taxRate = settings?.taxRate || 0.0;

    const invoiceNumber = await this.getNextInvoiceNumber(tenantId);
    const dueDate = data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const formattedItems = data.items.map(item => {
      const totalPrice = item.qty * item.unitPrice;
      return {
        productId: item.productId || null,
        description: item.description,
        qty: item.qty,
        unitPrice: item.unitPrice,
        totalPrice
      };
    });

    const subtotal = formattedItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        customerId: data.customerId,
        invoiceNumber,
        billingPeriod: data.billingPeriod,
        subtotal,
        taxAmount,
        totalAmount,
        paidAmount: 0.0,
        status: 'unpaid',
        dueDate,
        notes: data.notes || null,
        items: {
          create: formattedItems
        }
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true, address: true }
        },
        items: {
          include: { product: true }
        }
      }
    });

    return invoice;
  }

  /**
   * Get list of invoices with filtering, pagination and customer search
   */
  async getInvoices(tenantId: string, query: GetInvoicesQuery = {}) {
    const { customerId, status, billingPeriod, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (billingPeriod) where.billingPeriod = billingPeriod;

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } }
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true, phone: true, email: true }
          },
          items: true
        }
      }),
      prisma.invoice.count({ where })
    ]);

    return {
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get invoice details by ID
   */
  async getInvoiceById(tenantId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true, address: true }
        },
        items: {
          include: { product: true }
        }
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return invoice;
  }

  /**
   * Update invoice payment status / record payment
   */
  async updateInvoiceStatus(
    tenantId: string,
    invoiceId: string,
    data: { status?: string; paidAmount?: number; notes?: string }
  ) {
    const existing = await this.getInvoiceById(tenantId, invoiceId);

    let newPaidAmount = existing.paidAmount;
    if (typeof data.paidAmount === 'number') {
      newPaidAmount = Math.min(existing.totalAmount, Math.max(0, data.paidAmount));
    }

    let computedStatus = data.status || existing.status;
    if (newPaidAmount >= existing.totalAmount) {
      computedStatus = 'paid';
    } else if (newPaidAmount > 0) {
      computedStatus = 'partial';
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: newPaidAmount,
        status: computedStatus,
        notes: data.notes ? `${existing.notes || ''}\n${data.notes}`.trim() : existing.notes
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true }
        },
        items: true
      }
    });

    return updated;
  }

  /**
   * Cancel / void an invoice
   */
  async cancelInvoice(tenantId: string, invoiceId: string) {
    await this.getInvoiceById(tenantId, invoiceId);

    const cancelled = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'cancelled' }
    });

    return cancelled;
  }

  /**
   * Get tenant billing KPIs summary
   */
  async getBillingSummary(tenantId: string) {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId, status: { not: 'cancelled' } }
    });

    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const totalOutstanding = totalInvoiced - totalPaid;

    const now = new Date();
    const overdueCount = invoices.filter(inv => inv.status !== 'paid' && inv.dueDate < now).length;
    const unpaidCount = invoices.filter(inv => inv.status === 'unpaid').length;
    const partialCount = invoices.filter(inv => inv.status === 'partial').length;
    const paidCount = invoices.filter(inv => inv.status === 'paid').length;

    return {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      totalInvoices: invoices.length,
      overdueCount,
      unpaidCount,
      partialCount,
      paidCount
    };
  }
}
