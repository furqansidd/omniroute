import { Router } from 'express';
import { ProductController } from './product.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const productRouter = Router();

productRouter.use(authenticateToken);

// Products CRUD
productRouter.get('/products', requirePermission('products', 'read'), ProductController.listProducts);
productRouter.post('/products', requirePermission('products', 'create'), ProductController.createProduct);
productRouter.put('/products/:id', requirePermission('products', 'update'), ProductController.updateProduct);

// Warehouses & Depots
productRouter.get('/warehouses', requirePermission('stock', 'read'), ProductController.listWarehouses);
productRouter.post('/warehouses', requirePermission('stock', 'create'), ProductController.createWarehouse);

// Stock Levels & Movements
productRouter.get('/stock', requirePermission('stock', 'read'), ProductController.getStockLevels);
productRouter.post('/stock/movement', requirePermission('stock', 'create'), ProductController.recordStockMovement);
