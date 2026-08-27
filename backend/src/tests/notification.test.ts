import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;
let customerId: string;
let createdTemplateId: string;

describe('Module 14 — Notification Engine API', () => {
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

  it('GET /api/v1/notifications/templates auto-seeds and lists default templates', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/templates`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 5);
  });

  it('POST /api/v1/notifications/templates creates a custom event template', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: 'Special Promotion Hook',
        eventTrigger: 'promo_alert',
        channel: 'whatsapp',
        body: 'Special offer for {{customer_name}}! Get 10% off your next {{product_name}} refill from {{company_name}}.'
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.ok(body.data.id);
    assert.equal(body.data.eventTrigger, 'promo_alert');

    createdTemplateId = body.data.id;
  });

  it('POST /api/v1/notifications/trigger executes automated event trigger with dynamic tag interpolation', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        eventTrigger: 'out_for_delivery',
        payload: {
          customerId,
          recipientPhone: '+15559998888',
          data: {
            customer_name: 'John Doe',
            order_number: 'ORD-9901',
            rider_name: 'David Miller (Rider)'
          }
        }
      })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.renderedBody.includes('John Doe'));
    assert.ok(body.data.renderedBody.includes('ORD-9901'));
    assert.ok(body.data.renderedBody.includes('David Miller'));
    assert.equal(body.data.log.status, 'sent');
  });

  it('POST /api/v1/notifications/send dispatches a direct manual message', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        customerId,
        recipientPhone: '+15551234567',
        channel: 'whatsapp',
        body: 'Your scheduled water container pickup is arriving tomorrow at 10 AM.'
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.recipientPhone, '+15551234567');
    assert.equal(body.data.status, 'sent');
  });

  it('GET /api/v1/notifications/logs returns message audit logs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/logs`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 2);
  });

  it('GET /api/v1/notifications/stats returns notification KPI summary', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.totalSent === 'number');
    assert.ok(typeof body.data.totalWhatsapp === 'number');
    assert.ok(typeof body.data.successRate === 'number');
  });
});
