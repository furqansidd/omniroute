import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let riderAuthToken: string;
let riderId: string;

describe('Module 11 — Live Trackboard & GPS Telemetry API', () => {
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
        identifier: 'rider1@aquaflow.com',
        password: 'Rider@123456'
      })
    });
    const loginData = await loginRes.json();
    riderAuthToken = loginData.data.accessToken;
    riderId = loginData.data.user.id;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('POST /api/v1/trackboard/pings records GPS telemetry ping from rider app', async () => {
    const payload = {
      geoLat: 40.7128,
      geoLng: -74.0060,
      speed: 42.5,
      batteryLevel: 94,
      heading: 270
    };

    const res = await fetch(`${baseUrl}/api/v1/trackboard/pings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${riderAuthToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.geoLat, 40.7128);
    assert.equal(body.data.batteryLevel, 94);
  });

  it('GET /api/v1/trackboard/live lists live rider telemetry for dispatcher dashboard', async () => {
    const res = await fetch(`${baseUrl}/api/v1/trackboard/live`, {
      headers: { Authorization: `Bearer ${riderAuthToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some((r: any) => r.rider.id === riderId && r.isOnline === true));
  });

  it('GET /api/v1/trackboard/history/:riderId returns historical GPS breadcrumbs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/trackboard/history/${riderId}`, {
      headers: { Authorization: `Bearer ${riderAuthToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });
});
