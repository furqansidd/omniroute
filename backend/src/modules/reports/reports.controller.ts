import { Request, Response } from 'express';
import { ReportsService } from './reports.service.js';

const reportsService = new ReportsService();

export class ReportsController {
  static async getExecutiveDashboardStats(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const stats = await reportsService.getExecutiveDashboardStats(tenantId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getSalesReport(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const report = await reportsService.getSalesReport(tenantId);
      res.json({ success: true, data: report });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getInventoryReport(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const report = await reportsService.getInventoryReport(tenantId);
      res.json({ success: true, data: report });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getRiderPerformanceReport(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const report = await reportsService.getRiderPerformanceReport(tenantId);
      res.json({ success: true, data: report });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getEmptiesReport(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const report = await reportsService.getEmptiesReport(tenantId);
      res.json({ success: true, data: report });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
