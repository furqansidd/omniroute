import { Router } from 'express';
import { PurchaseController } from './purchase.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

export const purchaseRouter = Router();

purchaseRouter.use(authenticateToken);

// Vendors
purchaseRouter.get('/vendors', PurchaseController.listVendors);
purchaseRouter.post('/vendors', PurchaseController.createVendor);
purchaseRouter.get('/vendors/:id', PurchaseController.getVendorById);

// Purchase Orders
purchaseRouter.get('/orders', PurchaseController.listPurchaseOrders);
purchaseRouter.post('/orders', PurchaseController.createPurchaseOrder);

// Goods Receipt Notes (GRN)
purchaseRouter.post('/grn', PurchaseController.createGoodsReceipt);
