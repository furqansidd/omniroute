import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;
let createdCustomerId: string;
let productId: string;

describe('Module 4 — Customer Management & Security Deposit API', () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });

    // Obtain access token by logging in as Owner
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

    // Get returnable product ID
    const prod = await prisma.product.findFirst({
      where: { tenantId: 'demo-tenant-aquaflow', isReturnableContainer: true }
    });
    productId = prod!.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('GET /api/v1/customers lists seeded customers for tenant', async () => {
    const res = await fetch(`${baseUrl}/api/v1/customers`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  it('POST /api/v1/customers creates a new customer record', async () => {
    const payload = {
      name: 'Metro Grand Hotel',
      phone: '+15553334455',
      email: 'concierge@metrogrand.com',
      address: '700 Luxury Avenue',
      customerType: 'commercial'
    };

    const res = await fetch(`${baseUrl}/api/v1/customers`, {
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
    assert.equal(body.data.name, 'Metro Grand Hotel');
    assert.equal(body.data.customerType, 'commercial');
    createdCustomerId = body.data.id;
  });

  it('POST /api/v1/customers/:id/rates sets custom product price override', async () => {
    const res = await fetch(`${baseUrl}/api/v1/customers/${createdCustomerId}/rates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productId,
        customPrice: 4.25
      })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.customPrice, 4.25);
  });

  it('POST /api/v1/customers/:id/deposits records container deposit ledger', async () => {
    const res = await fetch(`${baseUrl}/api/v1/customers/${createdCustomerId}/deposits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productId,
        qtyChange: 15,
        depositChange: 150.0
      })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.qtyHeld, 15);
    assert.equal(body.data.depositAmount, 150.0);
  });

  it('GET /api/v1/customers/:id fetches complete customer details with rates and deposit ledger', async () => {
    const res = await fetch(`${baseUrl}/api/v1/customers/${createdCustomerId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.name, 'Metro Grand Hotel');
    assert.equal(body.data.productRates[0].customPrice, 4.25);
    assert.equal(body.data.securityLedgers[0].qtyHeld, 15);
  });
});
