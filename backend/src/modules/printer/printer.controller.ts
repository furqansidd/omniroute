import { Request, Response } from 'express';
import { PrinterService } from './printer.service.js';

const printerService = new PrinterService();

export class PrinterController {
  static async generateReceiptTemplate(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { receiptType, payload } = req.body;
      if (!receiptType) {
        res.status(400).json({ success: false, error: 'receiptType is required (delivery_receipt, payment_voucher, empties_receipt)' });
        return;
      }

      const result = await printerService.generateReceiptTemplate(tenantId, receiptType, payload || {});
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getPrinterSettings(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const settings = await printerService.getPrinterSettings(tenantId);
      res.json({ success: true, data: settings });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async updatePrinterSettings(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const updated = await printerService.updatePrinterSettings(tenantId, req.body);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
