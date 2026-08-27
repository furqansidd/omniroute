import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../utils/prisma.js';
import { FinanceService } from './finance/finance.service.js';

describe('Rider Cash Collection & Admin Settlement Integration Test', () => {
  const financeService = new FinanceService();

  let testTenantId: string;
  let testRiderId: string;
  let testCustomerId: string;
  let testOrderId: string;

  before(async () => {
    // 1. Setup Test Tenant
    const tenant = await prisma.tenant.create({
      data: {
        companyName: `Test Rider Finance Corp ${Date.now()}`,
        industryType: 'milk',
        subscriptionTier: 'enterprise'
      }
    });
    testTenantId = tenant.id;

    // 2. Setup Role & Rider
    const role = await prisma.role.create({
      data: { tenantId: testTenantId, name: 'Rider' }
    });

    const rider = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        roleId: role.id,
        name: 'Test Rider Asif',
        email: `asif_${Date.now()}@rider.com`,
        phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
        passwordHash: 'hashed'
      }
    });
    testRiderId = rider.id;

    // 3. Setup Customer & Delivery
    const customer = await prisma.customer.create({
      data: {
        tenantId: testTenantId,
        name: 'Test Customer Tariq',
        phone: `0311${Math.floor(1000000 + Math.random() * 9000000)}`,
        address: 'House 12 Gulberg Lahore'
      }
    });
    testCustomerId = customer.id;

    const order = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        customerId: customer.id,
        orderNumber: `ORD-${Date.now()}`,
        totalAmount: 3660,
        status: 'delivered'
      }
    });
    testOrderId = order.id;

    // Record completed delivery with cash collected
    await prisma.delivery.create({
      data: {
        tenantId: testTenantId,
        orderId: order.id,
        riderId: rider.id,
        scheduledDate: new Date(),
        status: 'delivered',
        deliveredQty: 20,
        cashCollected: 3660,
        deliveredAt: new Date()
      }
    });
  });

  after(async () => {
    if (testTenantId) {
      await prisma.tenant.delete({ where: { id: testTenantId } });
    }
  });

  test('Step 1: Verify Rider Cash Holding reflects collected route cash', async () => {
    const holdings = await financeService.getRiderCashHoldings(testTenantId);
    assert.equal(holdings.totalRiderCashHeld, 3660);

    const riderInfo = holdings.riders.find(r => r.id === testRiderId);
    assert.ok(riderInfo);
    assert.equal(riderInfo.totalCollected, 3660);
    assert.equal(riderInfo.totalHandedOver, 0);
    assert.equal(riderInfo.netCashHeld, 3660);
  });

  test('Step 2: Admin receives cash handover from Rider and settles wallet', async () => {
    const handoverResult = await financeService.settleRiderCashHandover(testTenantId, {
      riderId: testRiderId,
      amount: 3660,
      paymentMethod: 'cash',
      notes: 'Route collection handover'
    });

    assert.ok(handoverResult.voucher);
    assert.equal(handoverResult.voucher.amount, 3660);
    assert.equal(handoverResult.voucher.category, 'rider_collection_handover');

    // Re-verify rider holdings after handover
    const holdingsAfter = await financeService.getRiderCashHoldings(testTenantId);
    assert.equal(holdingsAfter.totalRiderCashHeld, 0);

    const riderInfoAfter = holdingsAfter.riders.find(r => r.id === testRiderId);
    assert.ok(riderInfoAfter);
    assert.equal(riderInfoAfter.totalHandedOver, 3660);
    assert.equal(riderInfoAfter.netCashHeld, 0);
  });

  test('Step 3: Verify Financial Overview reflects Admin Cash Balance', async () => {
    const overview = await financeService.getFinancialOverview(testTenantId);
    assert.equal(overview.totalRiderCashHeld, 0);
    assert.equal(overview.adminCashBalance, 3660);
  });

  test('Step 4: Verify Rider Statement Ledger timeline', async () => {
    const statement = await financeService.getRiderStatementLedger(testTenantId, testRiderId);
    assert.equal(statement.transactions.length, 2);
    assert.equal(statement.transactions[0].type, 'CASH_COLLECTION');
    assert.equal(statement.transactions[1].type, 'ADMIN_HANDOVER');
    assert.equal(statement.netCashHeld, 0);
  });
});
