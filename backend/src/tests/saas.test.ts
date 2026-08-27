import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import { SaasService } from '../modules/saas/saas.service.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;
const saasService = new SaasService();

describe('Module 21 — SaaS Subscription & Billing Metering API', () => {
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

  it('GET /api/v1/saas/metering returns tenant resource usage vs tier limits', async () => {
    const res = await fetch(`${baseUrl}/api/v1/saas/metering`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.companyName);
    assert.ok(body.data.usage.customers);
    assert.ok(body.data.usage.orders);
    assert.ok(body.data.usage.riders);
    assert.ok(typeof body.data.usage.customers.pct === 'number');
  });

  it('PUT /api/v1/saas/tier updates tenant subscription tier', async () => {
    const res = await fetch(`${baseUrl}/api/v1/saas/tier`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ tier: 'professional' })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.subscriptionTier, 'professional');
    assert.equal(body.data.priceMonthly, 149);
  });

  it('SaasService.checkQuotaLimit enforces tier limits and allows valid capacity', async () => {
    const isAllowed = await saasService.checkQuotaLimit('demo-tenant-aquaflow', 'customer');
    assert.equal(isAllowed, true);
  });

  it('GET /api/v1/saas/platform-overview returns platform operator MRR overview', async () => {
    const res = await fetch(`${baseUrl}/api/v1/saas/platform-overview`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.totalSubscribers === 'number');
    assert.ok(typeof body.data.totalMRR === 'number');
    assert.ok(Array.isArray(body.data.tenantMeterings));
  });
});
