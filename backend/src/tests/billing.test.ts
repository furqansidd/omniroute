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
let generatedInvoiceId: string;
let manualInvoiceId: string;

describe('Module 12 — Auto/Recurring Billing Engine API', () => {
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

  it('GET /api/v1/billing/summary returns tenant billing KPI stats', async () => {
    const res = await fetch(`${baseUrl}/api/v1/billing/summary`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.totalInvoiced === 'number');
    assert.ok(typeof body.data.totalPaid === 'number');
    assert.ok(typeof body.data.totalOutstanding === 'number');
  });

  it('POST /api/v1/billing/generate runs automated batch invoice generation', async () => {
    const res = await fetch(`${baseUrl}/api/v1/billing/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        billingPeriod: '2026-08',
        dueDateDays: 14
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.billingPeriod, '2026-08');
    assert.ok(typeof body.data.generatedCount === 'number');

    if (body.data.invoices && body.data.invoices.length > 0) {
      generatedInvoiceId = body.data.invoices[0].id;
      assert.ok(body.data.invoices[0].invoiceNumber.includes('000'));
    }
  });

  it('GET /api/v1/billing/invoices lists generated invoices', async () => {
    const res = await fetch(`${baseUrl}/api/v1/billing/invoices`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.meta.total >= 0);
  });

  it('POST /api/v1/billing/invoices creates a manual invoice with itemized breakdown', async () => {
    const res = await fetch(`${baseUrl}/api/v1/billing/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        customerId,
        billingPeriod: '2026-08',
        notes: 'Manual B2B Top-Up Invoice',
        items: [
          { productId, description: '19L Refill Bottle', qty: 5, unitPrice: 15.0 },
          { description: 'Delivery & Handling Charge', qty: 1, unitPrice: 10.0 }
        ]
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.ok(body.data.id);
    assert.ok(body.data.invoiceNumber.includes('000'));
    assert.equal(body.data.subtotal, 85.0); // (5 * 15) + (1 * 10) = 85
    assert.equal(body.data.items.length, 2);

    manualInvoiceId = body.data.id;
  });

  it('GET /api/v1/billing/invoices/:id fetches full invoice details', async () => {
    const res = await fetch(`${baseUrl}/api/v1/billing/invoices/${manualInvoiceId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.id, manualInvoiceId);
    assert.ok(body.data.customer);
    assert.equal(body.data.items.length, 2);
  });

  it('PATCH /api/v1/billing/invoices/:id/status records partial and full payments', async () => {
    // Record partial payment
    const partialRes = await fetch(`${baseUrl}/api/v1/billing/invoices/${manualInvoiceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        paidAmount: 50.0,
        notes: 'Received partial payment via Cash'
      })
    });
    const partialBody = await partialRes.json();

    assert.equal(partialRes.status, 200);
    assert.equal(partialBody.success, true);
    assert.equal(partialBody.data.paidAmount, 50.0);
    assert.equal(partialBody.data.status, 'partial');

    // Record remaining payment to complete invoice
    const fullRes = await fetch(`${baseUrl}/api/v1/billing/invoices/${manualInvoiceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        paidAmount: 100.0, // Paying full balance or more caps at totalAmount
        notes: 'Final payment received'
      })
    });
    const fullBody = await fullRes.json();

    assert.equal(fullRes.status, 200);
    assert.equal(fullBody.success, true);
    assert.equal(fullBody.data.paidAmount, fullBody.data.totalAmount);
    assert.equal(fullBody.data.status, 'paid');
  });

  it('DELETE /api/v1/billing/invoices/:id cancels invoice', async () => {
    // Create a temporary invoice to cancel
    const tempRes = await fetch(`${baseUrl}/api/v1/billing/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        customerId,
        billingPeriod: '2026-08',
        items: [{ description: 'Test Item', qty: 1, unitPrice: 20.0 }]
      })
    });
    const tempBody = await tempRes.json();
    const tempId = tempBody.data.id;

    const cancelRes = await fetch(`${baseUrl}/api/v1/billing/invoices/${tempId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const cancelBody = await cancelRes.json();

    assert.equal(cancelRes.status, 200);
    assert.equal(cancelBody.success, true);
    assert.equal(cancelBody.data.status, 'cancelled');
  });
});
