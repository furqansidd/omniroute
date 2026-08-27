import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../utils/prisma.js';

describe('Module 2 — Core Data Models & Relations Test Suite', () => {
  before(async () => {
    // Ensure DB connection
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it('Can query Tenant with all nested relations (Zones, Routes, Customers, Products, Warehouses)', async () => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: 'demo-tenant-aquaflow' },
      include: {
        settings: true,
        zones: { include: { routes: true } },
        customers: { include: { securityLedgers: true, productRates: true } },
        products: true,
        warehouses: true,
        orders: { include: { items: true, delivery: true } }
      }
    });

    assert.ok(tenant, 'Tenant should exist');
    assert.equal(tenant.companyName, 'AquaFlow Pure Water Supply');
    assert.equal(tenant.industryType, 'water');

    assert.ok(tenant.zones.length > 0, 'Should have zones seeded');
    assert.ok(tenant.customers.length > 0, 'Should have customers seeded');
    assert.ok(tenant.products.length > 0, 'Should have products seeded');
    assert.ok(tenant.warehouses.length > 0, 'Should have warehouses seeded');
    assert.ok(tenant.orders.length > 0, 'Should have orders seeded');
  });

  it('Verifies Customer Security Deposit Ledger and Returnable Container flags', async () => {
    const returnableBottle = await prisma.product.findFirst({
      where: { tenantId: 'demo-tenant-aquaflow', isReturnableContainer: true }
    });
    assert.ok(returnableBottle, 'Returnable bottle product should exist');
    assert.equal(returnableBottle.isReturnableContainer, true);

    const customer = await prisma.customer.findFirst({
      where: { tenantId: 'demo-tenant-aquaflow', name: 'Apex Tech Headquarters' },
      include: { securityLedgers: true }
    });
    assert.ok(customer, 'Customer Apex Tech should exist');
    assert.ok(customer.securityLedgers[0].qtyHeld > 0);
    assert.ok(customer.securityLedgers[0].depositAmount > 0);
  });

  it('Verifies Delivery execution record with empties collected and e-signature', async () => {
    const delivery = await prisma.delivery.findFirst({
      where: { tenantId: 'demo-tenant-aquaflow', status: 'delivered' },
      include: { order: { include: { items: true } }, rider: true }
    });

    assert.ok(delivery, 'Delivered delivery should exist');
    assert.equal(delivery.deliveredQty, 10);
    assert.equal(delivery.emptiesCollectedQty, 10);
    assert.ok(delivery.eSignatureUrl?.includes('sig-ord-001'), 'E-signature URL should be saved');
    assert.equal(delivery.cashCollected, 45.0);
  });

  it('Enforces unique constraint on SKU per tenant', async () => {
    try {
      await prisma.product.create({
        data: {
          tenantId: 'demo-tenant-aquaflow',
          name: 'Duplicate SKU Bottle',
          sku: 'AQF-19L-BOTTLE', // Existing SKU
          category: 'water_bottle',
          price: 5.0
        }
      });
      assert.fail('Should have thrown unique constraint error for duplicate SKU');
    } catch (e: any) {
      assert.ok(e.message.includes('Unique constraint') || e.code === 'P2002', 'Unique constraint error caught');
    }
  });

  it('Verifies StockLedger transaction entries for depot warehouse', async () => {
    const stockEntries = await prisma.stockLedger.findMany({
      where: { tenantId: 'demo-tenant-aquaflow' },
      include: { product: true, warehouse: true }
    });

    assert.ok(stockEntries.length > 0, 'Stock ledger entries should exist');
    assert.equal(stockEntries[0].transactionType, 'load');
    assert.equal(stockEntries[0].qty, 1500);
  });
});
