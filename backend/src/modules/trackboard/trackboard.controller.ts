import { Request, Response } from 'express';
import { TrackboardService } from './trackboard.service.js';

export class TrackboardController {
  static async recordPing(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const riderId = req.user!.userId;
      const { geoLat, geoLng } = req.body;

      if (geoLat === undefined || geoLng === undefined) {
        res.status(400).json({ success: false, error: 'geoLat and geoLng are required' });
        return;
      }

      const result = await TrackboardService.recordPing(tenantId, riderId, {
        geoLat: Number(geoLat),
        geoLng: Number(geoLng),
        speed: req.body.speed ? Number(req.body.speed) : undefined,
        batteryLevel: req.body.batteryLevel ? Number(req.body.batteryLevel) : undefined,
        heading: req.body.heading ? Number(req.body.heading) : undefined
      });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getLiveRiders(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await TrackboardService.getLiveRiders(tenantId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getRiderHistory(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await TrackboardService.getRiderHistory(tenantId, req.params.riderId, req.query as any);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
