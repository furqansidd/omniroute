import { Router } from 'express';
import { ProductionController } from './production.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const productionRouter = Router();

productionRouter.use(authenticateToken);

// Production Batches & QC Checks
productionRouter.post('/production/batches', requirePermission('products', 'create'), ProductionController.recordProductionBatch);
productionRouter.get('/production/batches', requirePermission('products', 'read'), ProductionController.getProductionBatches);
productionRouter.get('/production/stats', requirePermission('products', 'read'), ProductionController.getProductionStats);
