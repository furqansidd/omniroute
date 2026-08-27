import { Request, Response } from 'express';
import { ZoneService } from './zone.service.js';

export class ZoneController {
  static async listZones(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await ZoneService.listZones(tenantId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createZone(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { name } = req.body;
      if (!name) {
        res.status(400).json({ success: false, error: 'Zone name is required' });
        return;
      }

      const result = await ZoneService.createZone(tenantId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async updateZone(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await ZoneService.updateZone(tenantId, req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async listRoutes(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const zoneId = req.query.zoneId as string | undefined;
      const result = await ZoneService.listRoutes(tenantId, zoneId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createRoute(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { zoneId, name } = req.body;
      if (!zoneId || !name) {
        res.status(400).json({ success: false, error: 'zoneId and route name are required' });
        return;
      }

      const result = await ZoneService.createRoute(tenantId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async listVisitPlans(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await ZoneService.listVisitPlans(tenantId, req.query as any);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createVisitPlan(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { routeId, riderId, dayOfWeek } = req.body;
      if (!routeId || !riderId || dayOfWeek === undefined) {
        res.status(400).json({ success: false, error: 'routeId, riderId, and dayOfWeek are required' });
        return;
      }

      const result = await ZoneService.createVisitPlan(tenantId, {
        ...req.body,
        dayOfWeek: Number(dayOfWeek)
      });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteRoute(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      await ZoneService.deleteRoute(tenantId, req.params.id);
      res.json({ success: true, message: 'Route deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async deleteZone(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      await ZoneService.deleteZone(tenantId, req.params.id);
      res.json({ success: true, message: 'Zone deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

