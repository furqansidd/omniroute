import { prisma } from '../../utils/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.js';
import { INDUSTRY_PRODUCT_TEMPLATES } from './tenant.templates.js';

export interface OnboardTenantDto {
  companyName: string;
  industryType: 'water' | 'milk' | 'lpg' | 'oil' | 'multi';
  subscriptionTier?: 'starter' | 'professional' | 'enterprise';
  city?: string;
  currency?: string;
  timezone?: string;
  invoicePrefix?: string;
  taxRate?: number;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerPassword: string;
}

export class TenantService {
  static getTemplates(industryType: string) {
    const templates = INDUSTRY_PRODUCT_TEMPLATES[industryType] || INDUSTRY_PRODUCT_TEMPLATES['water'];
    return {
      industryType,
      recommendedProducts: templates
    };
  }

  static async onboard(dto: OnboardTenantDto) {
    const {
      companyName,
      industryType,
      subscriptionTier = 'starter',
      city = 'Metropolis',
      currency = 'USD',
      timezone = 'UTC',
      invoicePrefix = 'INV-',
      taxRate = 0.0,
      ownerName,
      ownerEmail,
      ownerPhone,
      ownerPassword
    } = dto;

    // Check if email or phone already registered
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: ownerEmail }, { phone: ownerPhone }] }
    });
    if (existingUser) {
      throw new Error('A user account with this email or phone already exists');
    }

    // Retrieve Tenant Owner system role
    const ownerRole = await prisma.role.findFirst({
      where: { name: 'Tenant Owner/Admin', tenantId: null }
    });
    if (!ownerRole) {
      throw new Error('System roles not seeded properly. Please run seed script first.');
    }

    const passwordHash = await hashPassword(ownerPassword);

    // Atomic transaction creating Tenant, Settings, Owner User, Warehouse, and Products
    const tenant = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          companyName,
          industryType,
          city,
          subscriptionTier,
          status: 'pending_approval',
          settings: {
            create: {
              currency,
              timezone,
              defaultLanguage: 'en',
              invoicePrefix,
              taxRate
            }
          }
        },
        include: { settings: true }
      });

      // Create Owner User
      const ownerUser = await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          roleId: ownerRole.id,
          name: ownerName,
          email: ownerEmail,
          phone: ownerPhone,
          passwordHash,
          status: 'active'
        }
      });

      // Create Default Main Depot Warehouse
      const warehouse = await tx.warehouse.create({
        data: {
          tenantId: createdTenant.id,
          name: `${companyName} Main Central Depot`,
          location: city
        }
      });

      // Auto-populate Industry Products from templates
      const templates = INDUSTRY_PRODUCT_TEMPLATES[industryType] || INDUSTRY_PRODUCT_TEMPLATES['water'];
      for (const item of templates) {
        const prod = await tx.product.create({
          data: {
            tenantId: createdTenant.id,
            name: item.name,
            sku: item.sku,
            category: item.category,
            unit: item.unit,
            price: item.price,
            isReturnableContainer: item.isReturnableContainer,
            serialTrackingRequired: item.serialTrackingRequired
          }
        });

        // Seed initial warehouse stock ledger entry
        await tx.stockLedger.create({
          data: {
            tenantId: createdTenant.id,
            productId: prod.id,
            warehouseId: warehouse.id,
            qty: 500,
            transactionType: 'load',
            referenceId: 'ONBOARDING-INITIAL-STOCK'
          }
        });
      }

      return { createdTenant, ownerUser };
    });

    const tokenPayload = {
      userId: tenant.ownerUser.id,
      tenantId: tenant.createdTenant.id,
      roleId: ownerRole.id,
      roleName: ownerRole.name
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    await prisma.refreshToken.create({
      data: {
        userId: tenant.ownerUser.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    return {
      accessToken,
      refreshToken,
      tenant: {
        id: tenant.createdTenant.id,
        companyName: tenant.createdTenant.companyName,
        industryType: tenant.createdTenant.industryType,
        subscriptionTier: tenant.createdTenant.subscriptionTier,
        settings: tenant.createdTenant.settings
      },
      user: {
        id: tenant.ownerUser.id,
        name: tenant.ownerUser.name,
        email: tenant.ownerUser.email,
        phone: tenant.ownerUser.phone,
        role: ownerRole.name
      }
    };
  }

  static async listTenants() {
    return prisma.tenant.findMany({
      include: {
        settings: true,
        _count: { select: { users: true, customers: true, orders: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
