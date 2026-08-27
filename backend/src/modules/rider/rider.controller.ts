import { Request, Response } from 'express';
import { RiderService } from './rider.service.js';

export class RiderController {
  static async getTodayRoute(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const riderId = req.user!.userId;
      const result = await RiderService.getTodayRoute(tenantId, riderId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getCustomerDetails(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await RiderService.getCustomerDetails(tenantId, req.params.customerId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }
}
