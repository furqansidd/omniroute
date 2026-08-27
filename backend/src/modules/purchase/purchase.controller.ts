import { Request, Response } from 'express';
import { PurchaseService } from './purchase.service.js';

export class PurchaseController {
  // Vendors
  static async listVendors(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const vendors = await PurchaseService.listVendors(tenantId);
      res.json({ success: true, data: vendors });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, message: err.message });
    }
  }

  static async createVendor(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const vendor = await PurchaseService.createVendor(tenantId, req.body);
      res.status(201).json({ success: true, data: vendor });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message, message: err.message });
    }
  }

  static async getVendorById(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const vendor = await PurchaseService.getVendorById(tenantId, req.params.id);
      if (!vendor) {
        res.status(404).json({ success: false, error: 'Vendor not found', message: 'Vendor not found' });
        return;
      }
      res.json({ success: true, data: vendor });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, message: err.message });
    }
  }

  // Purchase Orders
  static async listPurchaseOrders(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const orders = await PurchaseService.listPurchaseOrders(tenantId);
      res.json({ success: true, data: orders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, message: err.message });
    }
  }

  static async createPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const po = await PurchaseService.createPurchaseOrder(tenantId, req.body);
      res.status(201).json({ success: true, data: po });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message, message: err.message });
    }
  }

  // Goods Receipt (GRN)
  static async createGoodsReceipt(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.userId;
      const result = await PurchaseService.createGoodsReceipt(tenantId, userId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message, message: err.message });
    }
  }
}
