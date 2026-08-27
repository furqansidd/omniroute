import { Router } from 'express';
import { BreakageController } from './breakage.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const breakageRouter = Router();

breakageRouter.use(authenticateToken);

// Breakage logs & statistics
breakageRouter.get('/breakage/stats', requirePermission('products', 'read'), BreakageController.getBreakageStats);
breakageRouter.get('/breakage/logs', requirePermission('products', 'read'), BreakageController.getBreakageLogs);

// Log new breakage / spoilage incident
breakageRouter.post('/breakage/log', requirePermission('products', 'create'), BreakageController.logBreakageWastage);
