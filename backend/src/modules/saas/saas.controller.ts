import { Request, Response } from 'express';
import { SaasService } from './saas.service.js';

const saasService = new SaasService();

export class SaasController {
  static async getTenantMetering(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const metering = await saasService.getTenantMetering(tenantId);
      res.json({ success: true, data: metering });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async updateSubscriptionTier(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { tier } = req.body;
      if (!tier) {
        res.status(400).json({ success: false, error: 'tier is required (starter, professional, enterprise)' });
        return;
      }

      const updated = await saasService.updateSubscriptionTier(tenantId, tier);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getAllTenantsMetering(req: Request, res: Response) {
    try {
      const platformOverview = await saasService.getAllTenantsMetering();
      res.json({ success: true, data: platformOverview });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
