import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;
let customerId: string;

describe('Module 13 — Finance & Accounting API', () => {
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
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('POST /api/v1/finance/vouchers creates a receipt voucher and posts balanced journal entries', async () => {
    const res = await fetch(`${baseUrl}/api/v1/finance/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        voucherType: 'receipt',
        category: 'customer_collection',
        amount: 150.0,
        customerId,
        paymentMethod: 'cash',
        notes: 'Monthly collection payment'
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.ok(body.data.voucher.voucherNumber.startsWith('VCH-'));
    assert.equal(body.data.voucher.amount, 150.0);
    assert.ok(body.data.journalEntry.entryNumber.startsWith('JE-'));
  });

  it('POST /api/v1/finance/vouchers creates an expense payment voucher', async () => {
    const res = await fetch(`${baseUrl}/api/v1/finance/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        voucherType: 'payment',
        category: 'fuel_expense',
        accountName: 'Vehicle Fuel & Fleet Maintenance',
        amount: 45.0,
        paymentMethod: 'cash',
        notes: 'Rider Van Fuel Fill Up'
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.voucher.category, 'fuel_expense');
    assert.equal(body.data.voucher.amount, 45.0);
  });

  it('POST /api/v1/finance/vouchers creates a credit note adjustment for customer', async () => {
    const res = await fetch(`${baseUrl}/api/v1/finance/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        voucherType: 'credit_note',
        category: 'customer_discount',
        amount: 10.0,
        customerId,
        notes: 'Goodwill loyalty discount'
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.voucher.voucherType, 'credit_note');
    assert.equal(body.data.voucher.amount, 10.0);
  });

  it('GET /api/v1/finance/vouchers lists vouchers for tenant', async () => {
    const res = await fetch(`${baseUrl}/api/v1/finance/vouchers`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 3);
  });

  it('GET /api/v1/finance/customer-ledger/:id fetches customer statement ledger with running balance', async () => {
    const res = await fetch(`${baseUrl}/api/v1/finance/customer-ledger/${customerId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.customer);
    assert.ok(typeof body.data.netBalance === 'number');
    assert.ok(Array.isArray(body.data.transactions));
  });

  it('GET /api/v1/finance/general-ledger returns journal entries audit log', async () => {
    const res = await fetch(`${baseUrl}/api/v1/finance/general-ledger`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  it('GET /api/v1/finance/pnl generates Profit & Loss statement report', async () => {
    const res = await fetch(`${baseUrl}/api/v1/finance/pnl`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.revenue.grossSales === 'number');
    assert.ok(typeof body.data.operatingExpenses.total === 'number');
    assert.ok(typeof body.data.netProfit === 'number');
    assert.ok(typeof body.data.isProfitable === 'boolean');
  });

  it('GET /api/v1/finance/balance-sheet generates Balance Sheet report', async () => {
    const res = await fetch(`${baseUrl}/api/v1/finance/balance-sheet`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.assets.totalAssets === 'number');
    assert.ok(typeof body.data.liabilities.totalLiabilities === 'number');
    assert.ok(typeof body.data.equity.totalEquity === 'number');
    assert.equal(body.data.balanced, true);
  });
});
