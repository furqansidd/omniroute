import { Request, Response } from 'express';
import { SleepingService } from './sleeping.service.js';

const sleepingService = new SleepingService();

export class SleepingController {
  static async detectSleepingCustomers(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await sleepingService.detectSleepingCustomers(tenantId, req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getSleepingCustomers(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { riskScore, status, search, page, limit } = req.query;

      const result = await sleepingService.getSleepingCustomers(tenantId, {
        riskScore: riskScore as string,
        status: status as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });

      res.json({ success: true, data: result.customers, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async reactivateCustomer(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const updated = await sleepingService.reactivateCustomer(tenantId, req.params.id);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async triggerReengagementPromo(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await sleepingService.triggerReengagementPromo(tenantId, req.params.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getSleepingStats(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const stats = await sleepingService.getSleepingStats(tenantId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getSleepingRadar(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const radar = await sleepingService.getSleepingRadar(tenantId);
      res.json({ success: true, data: radar });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
