import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import { SuperAdminService } from '../modules/superadmin/superadmin.service.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;
const superAdminService = new SuperAdminService();

describe('Module 24 — Super Admin Dashboard & Business Owner Management API', () => {
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

  it('GET /api/v1/superadmin/stats returns high-level platform control metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/superadmin/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.totalTenants === 'number');
    assert.ok(typeof body.data.activeTenants === 'number');
    assert.ok(typeof body.data.totalRevenue === 'number');
    assert.ok(typeof body.data.totalMRR === 'number');
    assert.ok(Array.isArray(body.data.tierBreakdown));
    assert.ok(Array.isArray(body.data.industryBreakdown));
  });

  it('GET /api/v1/superadmin/owners returns business owners directory with metrics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/superadmin/owners`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    if (body.data.length > 0) {
      const owner = body.data[0];
      assert.ok(owner.id);
      assert.ok(owner.companyName);
      assert.ok(owner.industryType);
      assert.ok(owner.subscriptionTier);
    }
  });

  it('POST /api/v1/superadmin/payments logs a subscription payment from a business owner', async () => {
    const tenants = await prisma.tenant.findMany({ take: 1 });
    const tenantId = tenants[0]?.id || 'demo-tenant-aquaflow';

    const res = await fetch(`${baseUrl}/api/v1/superadmin/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        tenantId,
        amount: 149,
        planTier: 'professional',
        paymentMethod: 'bank_transfer',
        referenceNumber: 'REF-TEST-9988',
        notes: 'Annual upfront payment'
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.amount, 149);
    assert.equal(body.data.planTier, 'professional');
  });

  it('GET /api/v1/superadmin/payments lists all logged subscription payments', async () => {
    const res = await fetch(`${baseUrl}/api/v1/superadmin/payments`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
  });

  it('PUT /api/v1/superadmin/owners/:tenantId/status toggles tenant access status', async () => {
    const tenants = await prisma.tenant.findMany({ take: 1 });
    const tenantId = tenants[0].id;

    const res = await fetch(`${baseUrl}/api/v1/superadmin/owners/${tenantId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: 'suspended' })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'suspended');

    // Reset back to active
    await superAdminService.updateOwnerStatus(tenantId, 'active');
  });
});
