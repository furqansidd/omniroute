import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;

describe('Module 18 — Bluetooth ESC/POS Receipt Printing Engine API', () => {
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

  it('POST /api/v1/printer/generate creates a 58mm delivery_receipt with ESC/POS hex stream', async () => {
    const res = await fetch(`${baseUrl}/api/v1/printer/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        receiptType: 'delivery_receipt',
        payload: {
          orderNumber: 'ORD-8821',
          customerName: 'Alice Springs',
          customerPhone: '+15554443333',
          address: '456 Palm St',
          items: [
            { name: '19L Water Bottle', qty: 3, price: 5.00, total: 15.00 }
          ],
          emptiesReturned: 3,
          cashCollected: 15.00,
          riderName: 'John Rider'
        }
      })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.receiptType, 'delivery_receipt');
    assert.ok(body.data.formattedText.includes('DELIVERY RECEIPT'));
    assert.ok(body.data.formattedText.includes('Alice Springs'));
    assert.ok(body.data.escposCommandsHex.startsWith('1b40'));
    assert.ok(body.data.htmlPreview.includes('<pre'));
  });

  it('POST /api/v1/printer/generate creates payment_voucher receipt', async () => {
    const res = await fetch(`${baseUrl}/api/v1/printer/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        receiptType: 'payment_voucher',
        payload: {
          voucherNumber: 'VCH-9901',
          customerName: 'Robert Vance',
          amount: 50.00,
          paymentMethod: 'cash',
          remainingBalance: 0.00
        }
      })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.formattedText.includes('PAYMENT COLLECTION VOUCHER'));
    assert.ok(body.data.formattedText.includes('VCH-9901'));
  });

  it('POST /api/v1/printer/generate creates empties_receipt container ticket', async () => {
    const res = await fetch(`${baseUrl}/api/v1/printer/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        receiptType: 'empties_receipt',
        payload: {
          customerName: 'Corporate Office LLC',
          bottlesIssued: 10,
          bottlesReturned: 8,
          depositAmount: 100.00
        }
      })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.formattedText.includes('CONTAINER DEPOSIT TICKET'));
    assert.ok(body.data.formattedText.includes('NET CONTAINERS HELD:'));
  });

  it('GET /api/v1/printer/settings fetches tenant printer settings', async () => {
    const res = await fetch(`${baseUrl}/api/v1/printer/settings`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.companyName);
  });

  it('PUT /api/v1/printer/settings updates receipt header and footer notes', async () => {
    const res = await fetch(`${baseUrl}/api/v1/printer/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        headerNote: 'AquaFlow Purified Water Bottlers',
        footerNote: 'Thank you for choosing AquaFlow!',
        supportPhone: '+1-800-AQUAFLOW'
      })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
  });
});
