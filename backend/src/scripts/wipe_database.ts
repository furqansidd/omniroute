import { prisma } from '../utils/prisma.js';

async function wipeCompleteDatabase() {
  console.log('💥 Wiping EVERY SINGLE ITEM from database...');

  // 1. Transactional & Sub-Models
  await prisma.goodsReceiptItem.deleteMany({});
  await prisma.goodsReceipt.deleteMany({});
  await prisma.purchaseOrderItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.bOMItem.deleteMany({});
  await prisma.productionBatch.deleteMany({});
  await prisma.billOfMaterials.deleteMany({});
  await prisma.ledger.deleteMany({});
  await prisma.journalEntry.deleteMany({});
  await prisma.paymentVoucher.deleteMany({});
  await prisma.breakageWastageLog.deleteMany({});
  await prisma.stockLedger.deleteMany({});
  await prisma.delivery.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.recurringSchedule.deleteMany({});
  await prisma.customerProductRate.deleteMany({});
  await prisma.customerSecurityLedger.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.vendor.deleteMany({});
  await prisma.product.deleteMany({});

  // 2. Rider & Location Pings
  await prisma.riderLocationPing.deleteMany({});
  await prisma.visitPlanStop.deleteMany({});
  await prisma.visitPlan.deleteMany({});
  await prisma.routePoint.deleteMany({});
  await prisma.route.deleteMany({});
  await prisma.zone.deleteMany({});
  await prisma.warehouse.deleteMany({});
  await prisma.notificationLog.deleteMany({});

  // 3. Users, Auth Tokens, Roles, Permissions, Tenants
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.tenant.deleteMany({});

  console.log('✨ DATABASE IS NOW 100% EMPTY & WIPED!');
}

wipeCompleteDatabase()
  .catch((e) => {
    console.error('Error wiping database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
