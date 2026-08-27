import { Request, Response } from 'express';
import { ProductionService } from './production.service.js';

const productionService = new ProductionService();

export class ProductionController {
  static async recordProductionBatch(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const producedById = req.user!.userId;
      const batch = await productionService.recordProductionBatch(tenantId, producedById, req.body);
      res.status(201).json({ success: true, data: batch });
    } catch (error: any) {
      console.error('RECORD BATCH ERROR:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getProductionBatches(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { warehouseId, qualityPassed, search } = req.query;

      const filters: any = {};
      if (warehouseId) filters.warehouseId = String(warehouseId);
      if (qualityPassed !== undefined) filters.qualityPassed = qualityPassed === 'true';
      if (search) filters.search = String(search);

      const batches = await productionService.getProductionBatches(tenantId, filters);
      res.json({ success: true, data: batches });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getProductionStats(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const stats = await productionService.getProductionStats(tenantId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
