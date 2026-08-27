import { Request, Response } from 'express';
import { TenantService } from './tenant.service.js';

export class TenantController {
  static async onboard(req: Request, res: Response) {
    try {
      const { companyName, industryType, ownerName, ownerEmail, ownerPhone, ownerPassword } = req.body;
      if (!companyName || !industryType || !ownerName || !ownerEmail || !ownerPhone || !ownerPassword) {
        res.status(400).json({
          success: false,
          error: 'Missing required onboarding fields: companyName, industryType, ownerName, ownerEmail, ownerPhone, ownerPassword'
        });
        return;
      }

      const result = await TenantService.onboard(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Onboarding failed' });
    }
  }

  static async getTemplates(req: Request, res: Response) {
    try {
      const industryType = req.params.industryType || 'water';
      const result = TenantService.getTemplates(industryType);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async listTenants(req: Request, res: Response) {
    try {
      const result = await TenantService.listTenants();
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
