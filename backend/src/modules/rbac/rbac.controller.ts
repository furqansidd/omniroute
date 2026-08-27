import { Request, Response } from 'express';
import { RbacService } from './rbac.service.js';

const rbacService = new RbacService();

export class RbacController {
  static async listPermissions(req: Request, res: Response) {
    try {
      const permissions = await rbacService.listPermissions();
      res.json({ success: true, data: permissions });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async listRoles(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const roles = await rbacService.listRoles(tenantId);
      res.json({ success: true, data: roles });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createCustomRole(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const role = await rbacService.createCustomRole(tenantId, req.body);
      res.status(201).json({ success: true, data: role });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async updateRolePermissions(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { permissionIds } = req.body;
      const role = await rbacService.updateRolePermissions(tenantId, req.params.id, permissionIds || []);
      res.json({ success: true, data: role });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteCustomRole(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await rbacService.deleteCustomRole(tenantId, req.params.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async listUsers(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const users = await rbacService.listUsersWithRoles(tenantId);
      res.json({ success: true, data: users });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async assignUserRole(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { roleId } = req.body;
      const updated = await rbacService.assignUserRole(tenantId, req.params.id, roleId);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
