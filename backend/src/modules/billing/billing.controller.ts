import { Request, Response } from 'express';
import { BillingService } from './billing.service.js';

const billingService = new BillingService();

export class BillingController {
  static async generateBatchInvoices(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await billingService.generateBatchInvoices(tenantId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createManualInvoice(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { customerId, billingPeriod, items } = req.body;
      if (!customerId || !billingPeriod || !items || !Array.isArray(items)) {
        res.status(400).json({ success: false, error: 'customerId, billingPeriod, and items array are required' });
        return;
      }

      const invoice = await billingService.createManualInvoice(tenantId, req.body);
      res.status(201).json({ success: true, data: invoice });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getInvoices(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { customerId, status, billingPeriod, search, page, limit } = req.query;

      const result = await billingService.getInvoices(tenantId, {
        customerId: customerId as string,
        status: status as string,
        billingPeriod: billingPeriod as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });

      res.json({ success: true, data: result.invoices, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getInvoiceById(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const invoice = await billingService.getInvoiceById(tenantId, req.params.id);
      res.json({ success: true, data: invoice });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async updateInvoiceStatus(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const updated = await billingService.updateInvoiceStatus(tenantId, req.params.id, req.body);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async cancelInvoice(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const cancelled = await billingService.cancelInvoice(tenantId, req.params.id);
      res.json({ success: true, data: cancelled });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getBillingSummary(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const summary = await billingService.getBillingSummary(tenantId);
      res.json({ success: true, data: summary });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
