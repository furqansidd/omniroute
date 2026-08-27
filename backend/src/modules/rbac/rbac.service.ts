import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissionIds: string[];
}

export class RbacService {
  /**
   * List all available system permissions
   */
  async listPermissions() {
    return prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }]
    });
  }

  /**
   * List system roles + tenant custom roles
   */
  async listRoles(tenantId: string) {
    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { tenantId: null },
          { tenantId }
        ]
      },
      include: {
        permissions: {
          include: { permission: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return roles.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystemRole: r.isSystemRole,
      tenantId: r.tenantId,
      permissions: r.permissions.map(rp => ({
        id: rp.permission.id,
        module: rp.permission.module,
        action: rp.permission.action
      }))
    }));
  }

  /**
   * Create a new custom role for tenant
   */
  async createCustomRole(tenantId: string, input: CreateRoleInput) {
    if (!input.name) throw new Error('Role name is required');

    const role = await prisma.role.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description || null,
        isSystemRole: false
      }
    });

    if (input.permissionIds && input.permissionIds.length > 0) {
      for (const pId of input.permissionIds) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: pId
          }
        });
      }
    }

    return prisma.role.findUnique({
      where: { id: role.id },
      include: { permissions: { include: { permission: true } } }
    });
  }

  /**
   * Update permissions for a role in the permission matrix
   */
  async updateRolePermissions(tenantId: string, roleId: string, permissionIds: string[]) {
    const role = await prisma.role.findUnique({
      where: { id: roleId }
    });

    if (!role) throw new Error('Role not found');
    if (role.isSystemRole) {
      throw new Error('System default roles are protected and cannot be modified');
    }
    if (role.tenantId !== tenantId) {
      throw new Error('Unauthorized role modification');
    }

    // Delete existing permissions for role
    await prisma.rolePermission.deleteMany({
      where: { roleId }
    });

    // Re-create role permissions
    if (permissionIds && permissionIds.length > 0) {
      for (const pId of permissionIds) {
        await prisma.rolePermission.create({
          data: {
            roleId,
            permissionId: pId
          }
        });
      }
    }

    return prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } }
    });
  }

  /**
   * Delete custom role
   */
  async deleteCustomRole(tenantId: string, roleId: string) {
    const role = await prisma.role.findUnique({
      where: { id: roleId }
    });

    if (!role) throw new Error('Role not found');
    if (role.isSystemRole) throw new Error('System default roles cannot be deleted');
    if (role.tenantId !== tenantId) throw new Error('Unauthorized role deletion');

    const userCount = await prisma.user.count({
      where: { roleId }
    });
    if (userCount > 0) {
      throw new Error(`Cannot delete role: ${userCount} users are currently assigned to this role`);
    }

    await prisma.rolePermission.deleteMany({ where: { roleId } });
    await prisma.role.delete({ where: { id: roleId } });

    return { success: true };
  }

  /**
   * List users in tenant with their assigned roles
   */
  async listUsersWithRoles(tenantId: string) {
    return prisma.user.findMany({
      where: { tenantId },
      include: { role: true },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Reassign a user's role
   */
  async assignUserRole(tenantId: string, userId: string, roleId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId }
    });
    if (!user) throw new Error('User not found');

    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ tenantId: null }, { tenantId }]
      }
    });
    if (!role) throw new Error('Target role not found');

    return prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true }
    });
  }
}
