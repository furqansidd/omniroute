import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanAllOwners() {
  console.log('🧹 Cleaning all business owners & tenant data from Neon PostgreSQL...');

  const PLATFORM_TENANT_ID = 'platform-superadmin-tenant';
  const nonPlatformWhere = { tenantId: { not: PLATFORM_TENANT_ID } };

  // 1. Delete transactional & operational records for non-platform tenants
  await prisma.breakageWastageLog.deleteMany({ where: nonPlatformWhere });
  await prisma.delivery.deleteMany({ where: nonPlatformWhere });
  await prisma.orderItem.deleteMany({ where: { order: { tenantId: { not: PLATFORM_TENANT_ID } } } });
  await prisma.order.deleteMany({ where: nonPlatformWhere });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId: { not: PLATFORM_TENANT_ID } } } });
  await prisma.invoice.deleteMany({ where: nonPlatformWhere });
  await prisma.paymentVoucher.deleteMany({ where: nonPlatformWhere });
  await prisma.journalEntry.deleteMany({ where: nonPlatformWhere });
  await prisma.ledger.deleteMany({ where: nonPlatformWhere });
  await prisma.customerSecurityLedger.deleteMany({ where: nonPlatformWhere });
  await prisma.customerProductRate.deleteMany({ where: nonPlatformWhere });
  await prisma.recurringSchedule.deleteMany({ where: nonPlatformWhere });
  await prisma.customer.deleteMany({ where: nonPlatformWhere });
  await prisma.visitPlan.deleteMany({ where: nonPlatformWhere });
  await prisma.route.deleteMany({ where: nonPlatformWhere });
  await prisma.zone.deleteMany({ where: nonPlatformWhere });
  await prisma.stockLedger.deleteMany({ where: nonPlatformWhere });
  await prisma.productionBatch.deleteMany({ where: nonPlatformWhere });
  await prisma.warehouse.deleteMany({ where: nonPlatformWhere });
  await prisma.product.deleteMany({ where: nonPlatformWhere });
  await prisma.riderLocationPing.deleteMany({ where: nonPlatformWhere });
  await prisma.messageLog.deleteMany({ where: nonPlatformWhere });
  await prisma.messageTemplate.deleteMany({ where: nonPlatformWhere });

  // 2. Delete Users and Tokens
  await prisma.refreshToken.deleteMany({ where: { user: { tenantId: { not: PLATFORM_TENANT_ID } } } });
  await prisma.user.deleteMany({ where: nonPlatformWhere });

  // 3. Delete Roles, Tenant Settings & Payments
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId: { not: PLATFORM_TENANT_ID } } } });
  await prisma.role.deleteMany({ where: nonPlatformWhere });
  await prisma.tenantSettings.deleteMany({ where: nonPlatformWhere });
  await prisma.subscriptionPayment.deleteMany({ where: nonPlatformWhere });

  // 4. Delete all non-platform Tenants
  const deletedTenants = await prisma.tenant.deleteMany({
    where: { id: { not: PLATFORM_TENANT_ID } }
  });

  console.log(`✅ Successfully removed ${deletedTenants.count} tenant business owners and all associated data!`);
  console.log(`🛡️ System Super Admin (superadmin@tarsil.com) remains intact.`);
}

cleanAllOwners()
  .catch((err) => {
    console.error('❌ Error cleaning owners:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
