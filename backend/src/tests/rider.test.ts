import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let riderAuthToken: string;
let customerId: string;

describe('Module 8 — Rider Mobile App API', () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });

    // Login as Rider #1
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'rider1@aquaflow.com',
        password: 'Rider@123456'
      })
    });
    const loginData = await loginRes.json();
    riderAuthToken = loginData.data.accessToken;

    const cust = await prisma.customer.findFirst({ where: { tenantId: 'demo-tenant-aquaflow' } });
    customerId = cust!.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('GET /api/v1/rider/route fetches assigned route stops and deliveries for rider', async () => {
    const res = await fetch(`${baseUrl}/api/v1/rider/route`, {
      headers: { Authorization: `Bearer ${riderAuthToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.date);
    assert.ok(Array.isArray(body.data.assignedDeliveries));
  });

  it('GET /api/v1/rider/customers/:id fetches customer profile and deposit container balances', async () => {
    const res = await fetch(`${baseUrl}/api/v1/rider/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${riderAuthToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.id, customerId);
    assert.ok(Array.isArray(body.data.securityLedgers));
  });
});
