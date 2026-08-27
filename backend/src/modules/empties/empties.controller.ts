import { Request, Response } from 'express';
import { EmptiesService } from './empties.service.js';

export class EmptiesController {
  static async getEmptiesSummary(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await EmptiesService.getEmptiesSummary(tenantId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getEmptiesLedger(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await EmptiesService.getEmptiesLedger(tenantId, req.query as any);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async adjustContainerDeposit(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { customerId, productId, deltaQty } = req.body;
      if (!customerId || !productId || deltaQty === undefined) {
        res.status(400).json({ success: false, error: 'customerId, productId, and deltaQty are required' });
        return;
      }

      const result = await EmptiesService.adjustContainerDeposit(tenantId, {
        ...req.body,
        deltaQty: Number(deltaQty)
      });
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
