import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;

describe('Module 17 — Reporting & Analytics Dashboard API', () => {
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
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('GET /api/v1/reports/executive returns executive dashboard KPIs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/reports/executive`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.monthlyRevenue === 'number');
    assert.ok(typeof body.data.deliverySuccessRate === 'number');
    assert.ok(typeof body.data.activeCustomers === 'number');
  });

  it('GET /api/v1/reports/sales returns sales revenue breakdown & top products', async () => {
    const res = await fetch(`${baseUrl}/api/v1/reports/sales`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.totalInvoiced === 'number');
    assert.ok(body.data.methodBreakdown);
    assert.ok(Array.isArray(body.data.topSellingProducts));
  });

  it('GET /api/v1/reports/inventory returns warehouse stocks and breakage summaries', async () => {
    const res = await fetch(`${baseUrl}/api/v1/reports/inventory`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.warehouseStocks));
    assert.ok(typeof body.data.totalBreakageCost === 'number');
  });

  it('GET /api/v1/reports/riders returns rider delivery performance leaderboard', async () => {
    const res = await fetch(`${baseUrl}/api/v1/reports/riders`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  it('GET /api/v1/reports/empties returns container deposit liabilities', async () => {
    const res = await fetch(`${baseUrl}/api/v1/reports/empties`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.totalDepositsHeld === 'number');
    assert.ok(typeof body.data.returnRate === 'number');
  });
});
