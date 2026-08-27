import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;
let createdZoneId: string;
let createdRouteId: string;
let riderId: string;

describe('Module 6 — Zone, Route & Visit Planning API', () => {
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

    const riderUser = await prisma.user.findFirst({
      where: { tenantId: 'demo-tenant-aquaflow', email: 'rider1@aquaflow.com' }
    });
    riderId = riderUser!.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('GET /api/v1/zones lists zones for tenant', async () => {
    const res = await fetch(`${baseUrl}/api/v1/zones`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  it('POST /api/v1/zones creates a new delivery zone', async () => {
    const payload = {
      name: 'Zone C - West Suburbs',
      description: 'Residential single-family housing estates'
    };

    const res = await fetch(`${baseUrl}/api/v1/zones`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.name, 'Zone C - West Suburbs');
    createdZoneId = body.data.id;
  });

  it('POST /api/v1/routes creates a new route with sequence order', async () => {
    const payload = {
      zoneId: createdZoneId,
      name: 'Route C1 - Oakwood Estates',
      sequenceOrder: 2
    };

    const res = await fetch(`${baseUrl}/api/v1/routes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.sequenceOrder, 2);
    createdRouteId = body.data.id;
  });

  it('POST /api/v1/visit-plans creates a rider visit plan schedule', async () => {
    const payload = {
      routeId: createdRouteId,
      riderId,
      dayOfWeek: 2, // Tuesday
      scheduleType: 'daily'
    };

    const res = await fetch(`${baseUrl}/api/v1/visit-plans`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.dayOfWeek, 2);
  });

  it('GET /api/v1/visit-plans lists scheduled rider runs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/visit-plans?riderId=${riderId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.length > 0);
    assert.equal(body.data[0].rider.id, riderId);
  });
});
