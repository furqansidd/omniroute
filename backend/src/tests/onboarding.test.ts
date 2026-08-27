import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;

describe('Module 3 — Tenant Onboarding & Industry Catalog Generator', () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('GET /api/v1/tenants/templates/:industryType returns vertical-specific product presets', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tenants/templates/lpg`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.industryType, 'lpg');
    assert.ok(body.data.recommendedProducts.length >= 3);
    assert.ok(body.data.recommendedProducts.some((p: any) => p.sku === 'LPG-11KG'));
  });

  it('POST /api/v1/tenants/onboard creates Milk tenant, owner user, warehouse, and auto-populated product catalog', async () => {
    const timestamp = Date.now();
    const payload = {
      companyName: 'Pure Dairy Farms',
      industryType: 'milk',
      city: 'Milktown',
      currency: 'USD',
      invoicePrefix: 'PDF-',
      taxRate: 4.0,
      ownerName: 'Farmer Joe',
      ownerEmail: `joe_${timestamp}@puredairy.com`,
      ownerPhone: `+1555999${timestamp.toString().slice(-4)}`,
      ownerPassword: 'SecretPassword123'
    };

    const res = await fetch(`${baseUrl}/api/v1/tenants/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.ok(body.data.accessToken);
    assert.equal(body.data.tenant.companyName, 'Pure Dairy Farms');
    assert.equal(body.data.tenant.industryType, 'milk');

    // Verify DB state
    const products = await prisma.product.findMany({
      where: { tenantId: body.data.tenant.id }
    });
    assert.ok(products.length >= 4, 'Should have auto-populated milk catalog');

    const warehouse = await prisma.warehouse.findFirst({
      where: { tenantId: body.data.tenant.id }
    });
    assert.ok(warehouse, 'Default central depot should be created');
  });

  it('Prevents duplicate onboarding with existing email', async () => {
    const payload = {
      companyName: 'Duplicate Dairy',
      industryType: 'milk',
      ownerName: 'Duplicate Joe',
      ownerEmail: 'owner@aquaflow.com', // Pre-existing seeded email
      ownerPhone: '+15550001122',
      ownerPassword: 'SecretPassword123'
    };

    const res = await fetch(`${baseUrl}/api/v1/tenants/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.success, false);
    assert.ok(body.error.includes('already exists'));
  });
});
