import { Request, Response } from 'express';
import { CustomerService } from './customer.service.js';

export class CustomerController {
  static async list(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await CustomerService.list(tenantId, req.query as any);
      res.json({ success: true, data: result.customers, meta: result.meta });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await CustomerService.getById(tenantId, req.params.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { name, phone, address } = req.body;
      if (!name || !phone || !address) {
        res.status(400).json({ success: false, error: 'Missing required customer fields: name, phone, address' });
        return;
      }

      const result = await CustomerService.create(tenantId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await CustomerService.update(tenantId, req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async setCustomRate(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { productId, customPrice } = req.body;
      if (!productId || customPrice === undefined) {
        res.status(400).json({ success: false, error: 'productId and customPrice are required' });
        return;
      }

      const result = await CustomerService.setCustomRate(tenantId, req.params.id, productId, Number(customPrice));
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async adjustSecurityDeposit(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { productId, qtyChange, depositChange } = req.body;
      if (!productId || qtyChange === undefined) {
        res.status(400).json({ success: false, error: 'productId and qtyChange are required' });
        return;
      }

      const result = await CustomerService.adjustSecurityDeposit(
        tenantId,
        req.params.id,
        productId,
        Number(qtyChange),
        Number(depositChange || 0)
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      await CustomerService.delete(tenantId, req.params.id);
      res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

