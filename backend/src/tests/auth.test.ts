import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;

describe('Multi-Tenant Auth & RBAC API', () => {
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

  it('Health check endpoint returns ok status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.status, 'ok');
  });

  it('Login with valid email returns access and refresh tokens', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'owner@aquaflow.com',
        password: 'Admin@123456'
      })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.accessToken);
    assert.ok(body.data.refreshToken);
    assert.equal(body.data.user.email, 'owner@aquaflow.com');
  });

  it('Login with invalid password fails with 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'owner@aquaflow.com',
        password: 'WrongPassword'
      })
    });
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.success, false);
  });

  it('GET /api/v1/auth/me returns authenticated user details and permission list', async () => {
    // First login as Owner
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'owner@aquaflow.com',
        password: 'Admin@123456'
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.accessToken;

    // Fetch /me
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const meData = await meRes.json();

    assert.equal(meRes.status, 200);
    assert.equal(meData.success, true);
    assert.equal(meData.data.email, 'owner@aquaflow.com');
    assert.ok(meData.data.permissions.length > 0);
  });

  it('RBAC endpoint /api/v1/rbac/permissions enforces authentication and permissions', async () => {
    // Unauthenticated request should fail 401
    const unauthRes = await fetch(`${baseUrl}/api/v1/rbac/permissions`);
    assert.equal(unauthRes.status, 401);

    // Authenticated login as Owner
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'owner@aquaflow.com',
        password: 'Admin@123456'
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.accessToken;

    const authRes = await fetch(`${baseUrl}/api/v1/rbac/permissions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const authData = await authRes.json();

    assert.equal(authRes.status, 200);
    assert.equal(authData.success, true);
    assert.ok(Array.isArray(authData.data));
  });
});
