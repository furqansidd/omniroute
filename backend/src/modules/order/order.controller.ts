import { Request, Response } from 'express';
import { OrderService } from './order.service.js';

export class OrderController {
  static async listOrders(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await OrderService.listOrders(tenantId, req.query as any);
      res.json({ success: true, data: result.orders, meta: result.meta });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getOrderById(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await OrderService.getOrderById(tenantId, req.params.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async createOrder(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { customerId, items } = req.body;
      if (!customerId || !items || !Array.isArray(items)) {
        res.status(400).json({ success: false, error: 'customerId and items array are required' });
        return;
      }

      const result = await OrderService.createOrder(tenantId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async updateOrderStatus(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { status, riderId } = req.body;
      if (!status) {
        res.status(400).json({ success: false, error: 'status is required' });
        return;
      }

      const result = await OrderService.updateOrderStatus(tenantId, req.params.id, status, riderId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async listSchedules(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await OrderService.listSchedules(tenantId, req.query as any);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createSchedule(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { customerId, productId, frequency } = req.body;
      if (!customerId || !productId || !frequency) {
        res.status(400).json({ success: false, error: 'customerId, productId, and frequency are required' });
        return;
      }

      const result = await OrderService.createSchedule(tenantId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async updateScheduleStatus(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { status } = req.body;
      if (!status) {
        res.status(400).json({ success: false, error: 'status is required' });
        return;
      }

      const result = await OrderService.updateScheduleStatus(tenantId, req.params.id, status);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async generateDailyRuns(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { targetDate } = req.body;
      const result = await OrderService.generateDailyRuns(tenantId, targetDate);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
