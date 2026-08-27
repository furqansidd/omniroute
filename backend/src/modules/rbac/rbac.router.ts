import { Router } from 'express';
import { RbacController } from './rbac.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const rbacRouter = Router();

rbacRouter.use(authenticateToken);

// Permissions & Roles
rbacRouter.get('/permissions', requirePermission('roles', 'read'), RbacController.listPermissions);
rbacRouter.get('/roles', requirePermission('roles', 'read'), RbacController.listRoles);
rbacRouter.post('/roles', requirePermission('roles', 'create'), RbacController.createCustomRole);
rbacRouter.put('/roles/:id/permissions', requirePermission('roles', 'update'), RbacController.updateRolePermissions);
rbacRouter.delete('/roles/:id', requirePermission('roles', 'delete'), RbacController.deleteCustomRole);

// Users Role Assignment
rbacRouter.get('/users', requirePermission('roles', 'read'), RbacController.listUsers);
rbacRouter.put('/users/:id/role', requirePermission('roles', 'update'), RbacController.assignUserRole);
