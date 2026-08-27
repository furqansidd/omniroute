import { Request, Response } from 'express';
import { NotificationService } from './notification.service.js';

const notificationService = new NotificationService();

export class NotificationController {
  static async getTemplates(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const templates = await notificationService.getTemplates(tenantId);
      res.json({ success: true, data: templates });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async upsertTemplate(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { name, eventTrigger, body } = req.body;
      if (!name || !eventTrigger || !body) {
        res.status(400).json({ success: false, error: 'name, eventTrigger, and body are required' });
        return;
      }

      const template = await notificationService.upsertTemplate(tenantId, req.body);
      res.status(201).json({ success: true, data: template });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async triggerNotification(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { eventTrigger, payload } = req.body;
      if (!eventTrigger) {
        res.status(400).json({ success: false, error: 'eventTrigger is required' });
        return;
      }

      const result = await notificationService.triggerEventNotification(tenantId, eventTrigger, payload || {});
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async sendDirectNotification(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { recipientPhone, body } = req.body;
      if (!recipientPhone || !body) {
        res.status(400).json({ success: false, error: 'recipientPhone and body are required' });
        return;
      }

      const log = await notificationService.sendDirectNotification(tenantId, req.body);
      res.status(201).json({ success: true, data: log });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getMessageLogs(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { channel, status, search, page, limit } = req.query;

      const result = await notificationService.getMessageLogs(tenantId, {
        channel: channel as string,
        status: status as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });

      res.json({ success: true, data: result.logs, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getNotificationStats(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const stats = await notificationService.getNotificationStats(tenantId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
