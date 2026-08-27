import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RecordPaymentDTO {
  tenantId: string;
  amount: number;
  planTier: string;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
}

export class SuperAdminService {
  /**
   * High level platform overview statistics for Super Admin Portal
   */
  async getSuperAdminDashboardStats() {
    const PLATFORM_TENANT_ID = 'platform-superadmin-tenant';
    const notPlatformWhere = { id: { not: PLATFORM_TENANT_ID } };

    const [
      totalTenants,
      activeTenants,
      pendingApprovalTenants,
      suspendedTenants,
      cancelledTenants,
      totalPaymentsAgg,
      recentPayments,
      tenantsGroupedByTier,
      tenantsGroupedByIndustry
    ] = await Promise.all([
      prisma.tenant.count({ where: notPlatformWhere }),
      prisma.tenant.count({ where: { status: 'active', ...notPlatformWhere } }),
      prisma.tenant.count({ where: { status: 'pending_approval', ...notPlatformWhere } }),
      prisma.tenant.count({ where: { status: 'suspended', ...notPlatformWhere } }),
      prisma.tenant.count({ where: { status: 'cancelled', ...notPlatformWhere } }),
      prisma.subscriptionPayment.aggregate({
        _sum: { amount: true },
        where: { status: 'paid' }
      }),
      prisma.subscriptionPayment.findMany({
        take: 5,
        orderBy: { paymentDate: 'desc' },
        include: {
          tenant: {
            select: { companyName: true, subscriptionTier: true }
          }
        }
      }),
      prisma.tenant.groupBy({
        where: notPlatformWhere,
        by: ['subscriptionTier'],
        _count: { id: true }
      }),
      prisma.tenant.groupBy({
        where: notPlatformWhere,
        by: ['industryType'],
        _count: { id: true }
      })
    ]);

    // Calculate MRR from active subscription tiers (excluding platform tenant)
    const activeTenantsList = await prisma.tenant.findMany({
      where: { status: 'active', ...notPlatformWhere },
      select: { subscriptionTier: true }
    });

    const tierPrices: Record<string, number> = {
      starter: 49,
      professional: 149,
      enterprise: 399
    };

    let totalMRR = 0;
    activeTenantsList.forEach((t) => {
      const tierKey = (t.subscriptionTier || 'starter').toLowerCase();
      totalMRR += tierPrices[tierKey] || 49;
    });

    const totalRevenue = totalPaymentsAgg._sum.amount || 0;

    return {
      totalTenants,
      activeTenants,
      pendingApprovalTenants,
      suspendedTenants,
      cancelledTenants,
      totalRevenue,
      totalMRR,
      tierBreakdown: tenantsGroupedByTier.map((g) => ({
        tier: g.subscriptionTier,
        count: g._count.id
      })),
      industryBreakdown: tenantsGroupedByIndustry.map((g) => ({
        industry: g.industryType,
        count: g._count.id
      })),
      recentPayments
    };
  }

  /**
   * Detailed Business Owners Directory with search, filters & tenant metrics
   */
  async getBusinessOwners(filters?: {
    search?: string;
    industry?: string;
    tier?: string;
    status?: string;
  }) {
    const PLATFORM_TENANT_ID = 'platform-superadmin-tenant';
    const whereClause: any = { id: { not: PLATFORM_TENANT_ID } };

    if (filters?.industry && filters.industry !== 'all') {
      whereClause.industryType = filters.industry;
    }

    if (filters?.tier && filters.tier !== 'all') {
      whereClause.subscriptionTier = filters.tier;
    }

    if (filters?.status && filters.status !== 'all') {
      whereClause.status = filters.status;
    }

    if (filters?.search) {
      const searchLower = filters.search.trim();
      whereClause.OR = [
        { companyName: { contains: searchLower } },
        { city: { contains: searchLower } },
        {
          users: {
            some: {
              OR: [
                { name: { contains: searchLower } },
                { email: { contains: searchLower } },
                { phone: { contains: searchLower } }
              ]
            }
          }
        }
      ];
    }

    const tenants = await prisma.tenant.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          select: { name: true, email: true, phone: true }
        },
        subscriptionPayments: {
          where: { status: 'paid' },
          select: { amount: true }
        },
        _count: {
          select: {
            customers: true,
            orders: true,
            users: true
          }
        }
      }
    });

    return tenants.map((t) => {
      const totalPaidRevenue = t.subscriptionPayments.reduce((sum, p) => sum + p.amount, 0);
      const ownerUser = t.users[0] || null;

      return {
        id: t.id,
        companyName: t.companyName,
        industryType: t.industryType,
        subscriptionTier: t.subscriptionTier,
        city: t.city || 'N/A',
        status: t.status,
        createdAt: t.createdAt,
        ownerName: ownerUser?.name || 'Primary Owner',
        ownerEmail: ownerUser?.email || 'N/A',
        ownerPhone: ownerUser?.phone || 'N/A',
        totalCustomers: t._count.customers,
        totalOrders: t._count.orders,
        totalStaff: t._count.users,
        totalPaidRevenue
      };
    });
  }

  /**
   * Update Business Owner Status (Active, Suspended, Cancelled)
   */
  async updateOwnerStatus(tenantId: string, status: string) {
    const validStatuses = ['active', 'suspended', 'cancelled'];
    const statusKey = status.toLowerCase();

    if (!validStatuses.includes(statusKey)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: statusKey }
    });

    return updated;
  }

  /**
   * Update Business Owner Subscription Tier
   */
  async updateOwnerPlan(tenantId: string, subscriptionTier: string) {
    const validTiers = ['starter', 'professional', 'enterprise'];
    const tierKey = subscriptionTier.toLowerCase();

    if (!validTiers.includes(tierKey)) {
      throw new Error(`Invalid subscription tier. Supported tiers are: ${validTiers.join(', ')}`);
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionTier: tierKey }
    });

    return updated;
  }

  /**
   * Subscription Payment Receipts Ledger
   */
  async getSubscriptionPayments(tenantId?: string) {
    const whereClause: any = {};
    if (tenantId) whereClause.tenantId = tenantId;

    const payments = await prisma.subscriptionPayment.findMany({
      where: whereClause,
      orderBy: { paymentDate: 'desc' },
      include: {
        tenant: {
          select: {
            companyName: true,
            industryType: true,
            subscriptionTier: true
          }
        }
      }
    });

    return payments;
  }

  /**
   * Record a Subscription Payment from a Business Owner
   */
  async recordSubscriptionPayment(data: RecordPaymentDTO) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: data.tenantId }
    });

    if (!tenant) throw new Error('Business Owner / Tenant not found');

    const payment = await prisma.subscriptionPayment.create({
      data: {
        tenantId: data.tenantId,
        amount: data.amount,
        planTier: data.planTier || tenant.subscriptionTier,
        paymentMethod: data.paymentMethod || 'bank_transfer',
        referenceNumber: data.referenceNumber || `SUB-PAY-${Date.now().toString().slice(-6)}`,
        status: 'paid',
        notes: data.notes || null
      },
      include: {
        tenant: {
          select: { companyName: true, subscriptionTier: true }
        }
      }
    });

    // Activate tenant and update subscription tier if specified
    const updateData: any = { status: 'active' };
    if (data.planTier) {
      updateData.subscriptionTier = data.planTier.toLowerCase();
    }

    await prisma.tenant.update({
      where: { id: data.tenantId },
      data: updateData
    });

    return payment;
  }

  /**
   * Reject / Decline a Business Owner Registration Request
   */
  async rejectOwnerRegistration(tenantId: string, reason?: string) {
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'cancelled' }
    });

    return updated;
  }
}
