import { Request, Response } from 'express';
import { ProductService } from './product.service.js';

export class ProductController {
  static async listProducts(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await ProductService.listProducts(tenantId, req.query as any);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createProduct(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { name, sku, category, price } = req.body;
      if (!name || !sku || !category || price === undefined) {
        res.status(400).json({ success: false, error: 'Missing required fields: name, sku, category, price' });
        return;
      }

      const result = await ProductService.createProduct(tenantId, {
        ...req.body,
        price: Number(price)
      });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async updateProduct(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await ProductService.updateProduct(tenantId, req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async listWarehouses(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const result = await ProductService.listWarehouses(tenantId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createWarehouse(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { name } = req.body;
      if (!name) {
        res.status(400).json({ success: false, error: 'Warehouse name is required' });
        return;
      }

      const result = await ProductService.createWarehouse(tenantId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getStockLevels(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const warehouseId = req.query.warehouseId as string | undefined;
      const result = await ProductService.getStockLevels(tenantId, warehouseId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async recordStockMovement(req: Request, res: Response) {
    try {
      const tenantId = req.user!.tenantId;
      const { productId, qty, transactionType } = req.body;
      if (!productId || qty === undefined || !transactionType) {
        res.status(400).json({ success: false, error: 'productId, qty, and transactionType are required' });
        return;
      }

      const result = await ProductService.recordStockMovement(tenantId, {
        ...req.body,
        qty: Number(qty)
      });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
