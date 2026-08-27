import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;
let customerId: string;
let productId: string;

describe('Module 10 — Empties & Container Security Deposit API', () => {
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

    const cust = await prisma.customer.findFirst({ where: { tenantId: 'demo-tenant-aquaflow' } });
    customerId = cust!.id;

    const prod = await prisma.product.findFirst({ where: { tenantId: 'demo-tenant-aquaflow', isReturnableContainer: true } });
    productId = prod!.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('GET /api/v1/empties/summary returns container liabilities and return metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/empties/summary`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.totalContainersHeld === 'number');
    assert.ok(typeof body.data.totalDepositValueHeld === 'number');
  });

  it('GET /api/v1/empties/ledger lists customer container deposit ledgers', async () => {
    const res = await fetch(`${baseUrl}/api/v1/empties/ledger`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  it('POST /api/v1/empties/adjust records container deposit adjustment', async () => {
    const payload = {
      customerId,
      productId,
      deltaQty: -2, // Customer returned 2 empty bottles
      depositAmountChange: -10.0
    };

    const res = await fetch(`${baseUrl}/api/v1/empties/adjust`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.id);
  });
});
