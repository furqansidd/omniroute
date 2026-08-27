import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;
let createdProductId: string;
let warehouseId: string;

describe('Module 5 — Product & Inventory Management API', () => {
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

    const wh = await prisma.warehouse.findFirst({ where: { tenantId: 'demo-tenant-aquaflow' } });
    warehouseId = wh!.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('GET /api/v1/products lists product catalog for tenant', async () => {
    const res = await fetch(`${baseUrl}/api/v1/products`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  it('POST /api/v1/products creates a new returnable container product', async () => {
    const timestamp = Date.now();
    const payload = {
      name: '10L Glass Water Carboy',
      sku: `AQF-10L-GLASS-${timestamp}`,
      category: 'water_bottle',
      unit: 'carboy',
      price: 12.50,
      isReturnableContainer: true,
      serialTrackingRequired: true
    };

    const res = await fetch(`${baseUrl}/api/v1/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.isReturnableContainer, true);
    createdProductId = body.data.id;
  });

  it('GET /api/v1/warehouses lists central & mobile depots', async () => {
    const res = await fetch(`${baseUrl}/api/v1/warehouses`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.length > 0);
  });

  it('POST /api/v1/stock/movement posts auditable stock ledger entry', async () => {
    const payload = {
      productId: createdProductId,
      warehouseId,
      transactionType: 'load',
      qty: 250,
      referenceId: 'TEST-BATCH-LOAD-001'
    };

    const res = await fetch(`${baseUrl}/api/v1/stock/movement`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.qty, 250);
  });

  it('GET /api/v1/stock calculates live stock balances on hand', async () => {
    const res = await fetch(`${baseUrl}/api/v1/stock?warehouseId=${warehouseId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some((s: any) => s.product.id === createdProductId && s.currentQty === 250));
  });
});
