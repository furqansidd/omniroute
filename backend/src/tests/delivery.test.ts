import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let riderAuthToken: string;
let riderId: string;
let deliveryId: string;

describe('Module 9 — Delivery Execution API', () => {
  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });

    // Login as Rider
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
    riderId = loginData.data.user.id;

    // Create order and delivery for test
    const cust = await prisma.customer.findFirst({ where: { tenantId: 'demo-tenant-aquaflow' } });
    const prod = await prisma.product.findFirst({ where: { tenantId: 'demo-tenant-aquaflow', isReturnableContainer: true } });

    const order = await prisma.order.create({
      data: {
        tenantId: 'demo-tenant-aquaflow',
        customerId: cust!.id,
        orderNumber: `ORD-TEST-${Date.now()}`,
        status: 'assigned',
        totalAmount: 25.0,
        items: {
          create: [{ productId: prod!.id, qty: 5, unitPrice: 5.0, totalPrice: 25.0 }]
        }
      }
    });

    const delivery = await prisma.delivery.create({
      data: {
        tenantId: 'demo-tenant-aquaflow',
        orderId: order.id,
        riderId,
        scheduledDate: new Date(),
        status: 'pending'
      }
    });

    deliveryId = delivery.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('POST /api/v1/deliveries/:id/complete records delivery, empties, cash voucher & signature', async () => {
    const payload = {
      status: 'delivered',
      deliveredQty: 5,
      emptiesCollectedQty: 3,
      cashCollected: 25.0,
      eSignatureUrl: 'data:image/svg+xml;base64,SIG-VALID-EVID-998'
    };

    const res = await fetch(`${baseUrl}/api/v1/deliveries/${deliveryId}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${riderAuthToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'delivered');
    assert.equal(body.data.emptiesCollectedQty, 3);
    assert.equal(body.data.cashCollected, 25.0);

    // Verify StockLedger entries generated
    const stockEntries = await prisma.stockLedger.findMany({
      where: { referenceId: { contains: deliveryId } }
    });
    assert.ok(stockEntries.length >= 1);

    // Verify PaymentVoucher generated
    const vouchers = await prisma.paymentVoucher.findMany({
      where: { tenantId: 'demo-tenant-aquaflow', amount: 25.0 }
    });
    assert.ok(vouchers.length >= 1);
  });

  it('GET /api/v1/deliveries lists deliveries for tenant', async () => {
    const res = await fetch(`${baseUrl}/api/v1/deliveries`, {
      headers: { Authorization: `Bearer ${riderAuthToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some((d: any) => d.id === deliveryId && d.status === 'delivered'));
  });
});
