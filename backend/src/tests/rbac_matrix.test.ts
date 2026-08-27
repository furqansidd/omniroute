import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app.js';
import { prisma } from '../utils/prisma.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let authToken: string;
let createdRoleId: string;
let testUserId: string;

describe('Module 19 — Role & Permission Matrix Customization API', () => {
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

    const riderRole = await prisma.role.findFirst({ where: { name: { contains: 'Rider' } } });
    const dummyUser = await prisma.user.create({
      data: {
        tenantId: 'demo-tenant-aquaflow',
        roleId: riderRole ? riderRole.id : loginData.data.user.roleId,
        name: 'Dummy Staff User',
        email: 'dummy.staff@aquaflow.com',
        passwordHash: 'dummy'
      }
    });
    testUserId = dummyUser.id;
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: 'dummy.staff@aquaflow.com' } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('GET /api/v1/rbac/permissions lists system permissions', async () => {
    const res = await fetch(`${baseUrl}/api/v1/rbac/permissions`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  it('GET /api/v1/rbac/roles lists system default and tenant roles', async () => {
    const res = await fetch(`${baseUrl}/api/v1/rbac/roles`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  it('POST /api/v1/rbac/roles creates a new custom staff role', async () => {
    const perm = await prisma.permission.findFirst();

    const res = await fetch(`${baseUrl}/api/v1/rbac/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: 'Route Dispatcher',
        description: 'Manages route schedules and rider assignments',
        permissionIds: perm ? [perm.id] : []
      })
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.name, 'Route Dispatcher');
    assert.equal(body.data.isSystemRole, false);

    createdRoleId = body.data.id;
  });

  it('PUT /api/v1/rbac/roles/:id/permissions updates role permission matrix', async () => {
    const perms = await prisma.permission.findMany({ take: 3 });
    const pIds = perms.map(p => p.id);

    const res = await fetch(`${baseUrl}/api/v1/rbac/roles/${createdRoleId}/permissions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        permissionIds: pIds
      })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.permissions.length, pIds.length);
  });

  it('PUT /api/v1/rbac/users/:id/role reassigns user role', async () => {
    const res = await fetch(`${baseUrl}/api/v1/rbac/users/${testUserId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        roleId: createdRoleId
      })
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.roleId, createdRoleId);
  });

  it('DELETE /api/v1/rbac/roles/:id deletes custom role and protects system roles', async () => {
    // Reassign dummyUser to system role so custom role is no longer in use
    const riderRole = await prisma.role.findFirst({ where: { name: { contains: 'Rider' } } });
    if (riderRole) {
      await prisma.user.update({
        where: { id: testUserId },
        data: { roleId: riderRole.id }
      });
    }

    // Delete custom role
    const deleteRes = await fetch(`${baseUrl}/api/v1/rbac/roles/${createdRoleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const deleteBody = await deleteRes.json();
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteBody.success, true);

    // Try deleting system role (Owner)
    const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
    if (ownerRole) {
      const sysDeleteRes = await fetch(`${baseUrl}/api/v1/rbac/roles/${ownerRole.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.equal(sysDeleteRes.status, 400);
    }
  });
});
