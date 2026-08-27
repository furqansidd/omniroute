import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ReportsService {
  /**
   * Executive Dashboard High-Level KPI Aggregations
   */
  async getExecutiveDashboardStats(tenantId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalInvoices,
      totalDeliveries,
      completedDeliveries,
      activeCustomers,
      totalEmptiesHeld,
      totalBreakageCost
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { tenantId, createdAt: { gte: startOfMonth } },
        _sum: { totalAmount: true }
      }),
      prisma.delivery.count({ where: { tenantId } }),
      prisma.delivery.count({ where: { tenantId, status: 'delivered' } }),
      prisma.customer.count({ where: { tenantId, status: 'active' } }),
      prisma.customerSecurityLedger.aggregate({
        where: { tenantId },
        _sum: { depositAmount: true }
      }),
      prisma.breakageWastageLog.aggregate({
        where: { tenantId },
        _sum: { totalCost: true }
      })
    ]);

    const monthlyRevenue = totalInvoices._sum.totalAmount || 0;
    const deliverySuccessRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 100;

    return {
      monthlyRevenue: Number(monthlyRevenue.toFixed(2)),
      totalDeliveries,
      completedDeliveries,
      deliverySuccessRate: Math.round(deliverySuccessRate * 10) / 10,
      activeCustomers,
      emptiesDepositsHeld: totalEmptiesHeld._sum.depositAmount || 0,
      totalBreakageLoss: totalBreakageCost._sum.totalCost || 0
    };
  }

  /**
   * Sales & Revenue Analytics Report
   */
  async getSalesReport(tenantId: string) {
    const [invoices, paymentVouchers, products] = await Promise.all([
      prisma.invoice.findMany({ where: { tenantId } }),
      prisma.paymentVoucher.findMany({ where: { tenantId } }),
      prisma.product.findMany({
        where: { tenantId },
        include: { orderItems: { include: { order: true } } }
      })
    ]);

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;

    for (const inv of invoices) {
      totalInvoiced += inv.totalAmount;
      if (inv.status === 'paid') totalPaid += inv.totalAmount;
      else totalUnpaid += (inv.totalAmount - inv.paidAmount);
    }

    const methodBreakdown: Record<string, number> = {
      cash: 0,
      bank_transfer: 0,
      check: 0,
      card: 0
    };

    for (const v of paymentVouchers) {
      const m = v.paymentMethod || 'cash';
      if (!methodBreakdown[m]) methodBreakdown[m] = 0;
      methodBreakdown[m] += v.amount;
    }

    const topSellingProducts = products.map(p => {
      let qtySold = 0;
      let revenue = 0;
      for (const item of p.orderItems) {
        if (item.order.status === 'delivered') {
          qtySold += item.qty;
          revenue += item.totalPrice;
        }
      }
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        unitPrice: p.unitPrice,
        qtySold,
        revenue: Number(revenue.toFixed(2))
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return {
      totalInvoiced: Number(totalInvoiced.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      totalUnpaid: Number(totalUnpaid.toFixed(2)),
      methodBreakdown,
      topSellingProducts
    };
  }

  /**
   * Inventory Movement & Stock Ledger Analytics
   */
  async getInventoryReport(tenantId: string) {
    const [warehouses, stockMovements, breakageLogs] = await Promise.all([
      prisma.warehouse.findMany({
        where: { tenantId },
        include: { stockLedgers: { include: { product: true } } }
      }),
      prisma.stockLedger.findMany({
        where: { tenantId },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: { product: true, warehouse: true }
      }),
      prisma.breakageWastageLog.findMany({
        where: { tenantId },
        include: { product: true }
      })
    ]);

    let totalMovements = stockMovements.length;
    let totalBreakageQty = 0;
    let totalBreakageCost = 0;

    for (const b of breakageLogs) {
      totalBreakageQty += b.qty;
      totalBreakageCost += b.totalCost;
    }

    const warehouseStocks = warehouses.map(w => {
      let currentStock = 0;
      for (const s of w.stockLedgers) {
        currentStock += s.qty;
      }
      return {
        id: w.id,
        name: w.name,
        isRiderMobileDepot: w.isRiderMobileDepot,
        currentStock
      };
    });

    return {
      totalMovements,
      totalBreakageQty,
      totalBreakageCost: Number(totalBreakageCost.toFixed(2)),
      warehouseStocks,
      recentMovements: stockMovements.map(s => ({
        id: s.id,
        productName: s.product.name,
        warehouseName: s.warehouse?.name || 'Mobile Vehicle Depot',
        qty: s.qty,
        transactionType: s.transactionType,
        date: s.createdAt
      }))
    };
  }

  /**
   * Rider Delivery Performance Leaderboard
   */
  async getRiderPerformanceReport(tenantId: string) {
    const riders = await prisma.user.findMany({
      where: {
        tenantId,
        role: { name: { in: ['Rider', 'rider', 'RIDER'] } }
      },
      include: {
        riderVisitPlans: true,
        riderDeliveries: { include: { order: true } }
      }
    });

    const leaderboard = riders.map(rider => {
      const assignedRuns = rider.riderVisitPlans.length;
      const completedCount = rider.riderDeliveries.filter(d => d.status === 'delivered').length;
      const completionRate = assignedRuns > 0 ? (completedCount / assignedRuns) * 100 : completedCount > 0 ? 100 : 0;

      let cashCollected = 0;
      for (const d of rider.riderDeliveries) {
        if (d.status === 'delivered' && d.order) {
          cashCollected += d.order.totalAmount;
        }
      }

      let eSignaturesCaptured = 0;
      for (const d of rider.riderDeliveries) {
        if (d.proofOfDeliveryUrl) eSignaturesCaptured++;
      }

      return {
        id: rider.id,
        name: rider.name,
        phone: rider.phone,
        assignedRuns,
        completedCount,
        completionRate: Math.round(completionRate * 10) / 10,
        cashCollected: Number(cashCollected.toFixed(2)),
        eSignaturesCaptured
      };
    }).sort((a, b) => b.completedCount - a.completedCount);

    return leaderboard;
  }

  /**
   * Container & Security Deposit Liabilities Report
   */
  async getEmptiesReport(tenantId: string) {
    const ledgers = await prisma.customerSecurityLedger.findMany({
      where: { tenantId },
      include: { customer: true }
    });

    let totalDepositsHeld = 0;
    let totalContainersIssued = 0;
    let totalContainersReturned = 0;

    for (const l of ledgers) {
      totalDepositsHeld += l.depositAmount;
      totalContainersIssued += l.bottlesIssued;
      totalContainersReturned += l.bottlesReturned;
    }

    const returnRate = totalContainersIssued > 0 ? (totalContainersReturned / totalContainersIssued) * 100 : 100;

    return {
      totalDepositsHeld: Number(totalDepositsHeld.toFixed(2)),
      totalContainersIssued,
      totalContainersReturned,
      totalContainersHeld: totalContainersIssued - totalContainersReturned,
      returnRate: Math.round(returnRate * 10) / 10,
      customerLedgers: ledgers.map(l => ({
        id: l.id,
        customerName: l.customer.name,
        customerPhone: l.customer.phone,
        bottlesIssued: l.bottlesIssued,
        bottlesReturned: l.bottlesReturned,
        depositAmount: l.depositAmount
      }))
    };
  }
}
