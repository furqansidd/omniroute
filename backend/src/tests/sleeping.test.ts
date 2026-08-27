import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;
let sleepingCustomerId: string;

describe('Module 15 — Sleeping Customer Detection & Churn Alerts API', () => {
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

    // Create an old customer with an old creation date to guarantee a sleeping detection result
    const oldCust = await prisma.customer.create({
      data: {
        tenantId: 'demo-tenant-aquaflow',
        name: 'Dormant Test Customer',
        phone: '+15550009911',
        address: '100 Sleepy Hollow Rd',
        customerType: 'residential',
        status: 'active',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      }
    });
    sleepingCustomerId = oldCust.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('GET /api/v1/sleeping/stats returns tenant churn KPI statistics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sleeping/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.thresholdDays === 'number');
    assert.ok(typeof body.data.activeCount === 'number');
    assert.ok(typeof body.data.retentionRate === 'number');
  });

  it('POST /api/v1/sleeping/detect runs churn detection sweep and flags dormant customers', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sleeping/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        thresholdDays: 14,
        autoNotify: true
      })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.scannedCount > 0);
    assert.ok(body.data.sleepingDetectedCount >= 1);
  });

  it('GET /api/v1/sleeping/customers lists dormant customers with risk scores', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sleeping/customers`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
    assert.ok(body.data[0].daysInactive >= 14);
    assert.ok(body.data[0].riskScore);
  });

  it('POST /api/v1/sleeping/reengage/:id triggers win-back notification promo', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sleeping/reengage/${sleepingCustomerId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.success, true);
    assert.ok(body.data.renderedBody);
  });

  it('POST /api/v1/sleeping/reactivate/:id reactivates customer back to active', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sleeping/reactivate/${sleepingCustomerId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'active');
  });
});
