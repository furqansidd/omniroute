import { Request, Response } from 'express';
import { DeliveryService } from './delivery.service.js';

export class DeliveryController {
  static async completeDelivery(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const riderId = req.user!.userId;
      const deliveryId = req.params.id;

      const { status } = req.body;
      if (!status || !['delivered', 'failed'].includes(status)) {
        res.status(400).json({ success: false, error: 'status must be "delivered" or "failed"' });
        return;
      }

      const result = await DeliveryService.completeDelivery(tenantId, riderId, deliveryId, req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async listDeliveries(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await DeliveryService.listDeliveries(tenantId, req.query as any);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
