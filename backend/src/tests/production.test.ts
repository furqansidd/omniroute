import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;
let warehouseId: string;
let productId: string;

describe('Module 20 — Production & QC Batch Tracking API', () => {
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

    const tenantId = loginData.data.user.tenantId;
    let wh = await prisma.warehouse.findFirst({ where: { tenantId } });
    if (!wh) {
      wh = await prisma.warehouse.create({
        data: { tenantId, name: 'Main Production Depot', location: 'Metropolis' }
      });
    }
    let prod = await prisma.product.findFirst({ where: { tenantId } });
    if (!prod) {
      prod = await prisma.product.create({
        data: { tenantId, name: '19L Mineral Water Bottle', sku: 'AQF-19L-PROD-TEST', price: 5.0 }
      });
    }

    warehouseId = wh.id;
    productId = prod.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('POST /api/v1/production/batches records batch run and auto-posts stock ledger entry if QC passed', async () => {
    const batchNo = `BAT-TEST-${Date.now()}-001`;
    const res = await fetch(`${baseUrl}/api/v1/production/batches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        warehouseId,
        finishedProductId: productId,
        batchNumber: batchNo,
        industryType: 'water',
        inputQty: 500.0,
        outputQty: 100,
        qualityPassed: true,
        tdsLevel: 120.5,
        phLevel: 7.2,
        notes: 'Reverse Osmosis filtration run'
      })
    });
    const body = await res.json();
    console.log('RECORD BATCH RESPONSE:', res.status, body);

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.batchNumber, batchNo);
    assert.equal(body.data.outputQty, 100);
    assert.equal(body.data.qualityPassed, true);

    // Verify positive StockLedger entry was auto-posted
    const ledger = await prisma.stockLedger.findFirst({
      where: { referenceId: body.data.id, transactionType: 'production' }
    });
    assert.ok(ledger);
    assert.equal(ledger?.qty, 100);
  });

  it('POST /api/v1/production/batches handles failed QC run without posting stock', async () => {
    const failBatchNo = `BAT-FAIL-${Date.now()}-002`;
    const res = await fetch(`${baseUrl}/api/v1/production/batches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        warehouseId,
        finishedProductId: productId,
        batchNumber: failBatchNo,
        industryType: 'water',
        inputQty: 200.0,
        outputQty: 40,
        qualityPassed: false,
        tdsLevel: 450.0, // High TDS failed QC
        phLevel: 5.5,
        notes: 'Failed filtration membrane test'
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.qualityPassed, false);

    // Verify NO StockLedger entry posted for failed QC
    const ledger = await prisma.stockLedger.findFirst({
      where: { referenceId: body.data.id, transactionType: 'production' }
    });
    assert.equal(ledger, null);
  });

  it('GET /api/v1/production/batches lists production batch logs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/production/batches`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 2);
  });

  it('GET /api/v1/production/stats returns manufacturing KPI statistics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/production/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.totalBatches === 'number');
    assert.ok(typeof body.data.qcPassRate === 'number');
    assert.ok(typeof body.data.totalUnitsProduced === 'number');
  });
});
