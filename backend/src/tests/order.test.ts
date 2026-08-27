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
let createdOrderId: string;
let createdScheduleId: string;

describe('Module 7 — Order & Recurring Schedule Engine API', () => {
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

    const prod = await prisma.product.findFirst({ where: { tenantId: 'demo-tenant-aquaflow' } });
    productId = prod!.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('GET /api/v1/orders lists orders for tenant', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  it('POST /api/v1/orders creates manual order with custom rate resolution', async () => {
    const payload = {
      customerId,
      orderType: 'on_demand',
      items: [{ productId, qty: 5 }]
    };

    const res = await fetch(`${baseUrl}/api/v1/orders`, {
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
    assert.ok(body.data.orderNumber.startsWith('ORD-'));
    assert.equal(body.data.items[0].qty, 5);
    createdOrderId = body.data.id;
  });

  it('PUT /api/v1/orders/:id/status updates order status', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/${createdOrderId}/status`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'assigned' })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'assigned');
  });

  it('POST /api/v1/schedules creates recurring subscription schedule', async () => {
    const payload = {
      customerId,
      productId,
      qty: 2,
      frequency: 'daily',
      startDate: new Date().toISOString()
    };

    const res = await fetch(`${baseUrl}/api/v1/schedules`, {
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
    assert.equal(body.data.frequency, 'daily');
    createdScheduleId = body.data.id;
  });

  it('POST /api/v1/orders/generate-daily-runs triggers daily run generation', async () => {
    const res = await fetch(`${baseUrl}/api/v1/orders/generate-daily-runs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetDate: new Date().toISOString() })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.schedulesProcessed >= 1);
    assert.ok(body.data.generatedOrdersCount >= 1);
  });
});
