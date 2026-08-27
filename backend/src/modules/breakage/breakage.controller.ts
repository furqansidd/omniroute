import { Request, Response } from 'express';
import { BreakageService } from './breakage.service.js';

const breakageService = new BreakageService();

export class BreakageController {
  static async logBreakageWastage(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const reportedById = req.user!.userId;
      const result = await breakageService.logBreakageWastage(tenantId, reportedById, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getBreakageLogs(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { reason, liabilityType, productId, warehouseId, search, page, limit } = req.query;

      const result = await breakageService.getBreakageLogs(tenantId, {
        reason: reason as string,
        liabilityType: liabilityType as string,
        productId: productId as string,
        warehouseId: warehouseId as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });

      res.json({ success: true, data: result.logs, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getBreakageStats(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const stats = await breakageService.getBreakageStats(tenantId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
