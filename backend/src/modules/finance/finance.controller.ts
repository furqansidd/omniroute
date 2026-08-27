import { Request, Response } from 'express';
import { FinanceService } from './finance.service.js';

const financeService = new FinanceService();

export class FinanceController {
  static async createVoucher(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { voucherType, amount } = req.body;
      if (!voucherType || !amount || amount <= 0) {
        res.status(400).json({ success: false, error: 'voucherType and valid amount are required' });
        return;
      }

      const result = await financeService.createVoucher(tenantId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getVouchers(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { voucherType, category, customerId, vendorId, riderId, search, page, limit } = req.query;

      const result = await financeService.getVouchers(tenantId, {
        voucherType: voucherType as string,
        category: category as string,
        customerId: customerId as string,
        vendorId: vendorId as string,
        riderId: riderId as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20
      });

      res.json({ success: true, data: result.vouchers, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getRiderCashHoldings(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await financeService.getRiderCashHoldings(tenantId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async settleRiderCashHandover(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { riderId, amount, paymentMethod, notes } = req.body;
      if (!riderId || !amount || amount <= 0) {
        res.status(400).json({ success: false, error: 'riderId and valid amount are required' });
        return;
      }

      const result = await financeService.settleRiderCashHandover(tenantId, { riderId, amount, paymentMethod, notes });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getVendorLedger(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await financeService.getVendorLedger(tenantId, req.params.vendorId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async getRiderLedger(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await financeService.getRiderStatementLedger(tenantId, req.params.riderId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async getCustomerLedger(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await financeService.getCustomerStatementLedger(tenantId, req.params.customerId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async getGeneralLedger(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { page, limit } = req.query;
      const result = await financeService.getGeneralLedger(
        tenantId,
        page ? parseInt(page as string, 10) : 1,
        limit ? parseInt(limit as string, 10) : 30
      );
      res.json({ success: true, data: result.entries, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getPnLReport(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { startDate, endDate } = req.query;
      const result = await financeService.getPnLReport(
        tenantId,
        startDate as string,
        endDate as string
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getFinancialOverview(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await financeService.getFinancialOverview(tenantId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
