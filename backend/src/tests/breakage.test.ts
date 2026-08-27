import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;
let productId: string;
let warehouseId: string;
let riderId: string;

describe('Module 16 — Breakage & Wastage Tracking API', () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });

    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'owner@aquaflow.com',
        password: 'Admin@123456'
      })
    });
    const loginData = await loginRes.json();
    authToken = loginData.data.accessToken;

    const prod = await prisma.product.findFirst({ where: { tenantId: 'demo-tenant-aquaflow' } });
    productId = prod!.id;

    const wh = await prisma.warehouse.findFirst({ where: { tenantId: 'demo-tenant-aquaflow' } });
    warehouseId = wh!.id;

    const rider = await prisma.user.findFirst({ where: { tenantId: 'demo-tenant-aquaflow', role: { name: 'Rider' } } });
    riderId = rider ? rider.id : loginData.data.user.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('POST /api/v1/breakage/log creates a breakage incident and posts negative StockLedger adjustment', async () => {
    const res = await fetch(`${baseUrl}/api/v1/breakage/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        productId,
        warehouseId,
        qty: 5,
        unitCost: 15.00,
        reason: 'bottle_damage',
        liabilityType: 'company',
        notes: 'Dropped during warehouse loading'
      })
    });
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.log.qty, 5);
    assert.equal(body.data.log.totalCost, 75.00);
    assert.equal(body.data.log.liabilityType, 'company');

    // Check stock ledger deduction
    assert.equal(body.data.stockLedger.qty, -5);
    assert.equal(body.data.stockLedger.transactionType, 'breakage');
  });

  it('POST /api/v1/breakage/log records rider liability breakage', async () => {
    const res = await fetch(`${baseUrl}/api/v1/breakage/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        productId,
        warehouseId,
        qty: 2,
        unitCost: 20.00,
        reason: 'transport_loss',
        liabilityType: 'rider',
        responsibleRiderId: riderId,
        notes: 'Damaged during transit by rider'
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.log.liabilityType, 'rider');
    assert.equal(body.data.log.totalCost, 40.00);
  });

  it('GET /api/v1/breakage/logs returns breakage audit logs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/breakage/logs`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 2);
  });

  it('GET /api/v1/breakage/stats returns financial cost impact and liability breakdown', async () => {
    const res = await fetch(`${baseUrl}/api/v1/breakage/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.totalQtyLost >= 7);
    assert.ok(body.data.totalCostImpact >= 115.00);
    assert.ok(body.data.companyAbsorptionCost >= 75.00);
    assert.ok(body.data.riderLiabilityCost >= 40.00);
  });
});
