import { Router } from 'express';
import { ReportsController } from './reports.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const reportsRouter = Router();

reportsRouter.use(authenticateToken);

// Executive & BI Analytics Reports
reportsRouter.get('/reports/executive', requirePermission('reports', 'read'), ReportsController.getExecutiveDashboardStats);
reportsRouter.get('/reports/sales', requirePermission('reports', 'read'), ReportsController.getSalesReport);
reportsRouter.get('/reports/inventory', requirePermission('reports', 'read'), ReportsController.getInventoryReport);
reportsRouter.get('/reports/riders', requirePermission('reports', 'read'), ReportsController.getRiderPerformanceReport);
reportsRouter.get('/reports/empties', requirePermission('reports', 'read'), ReportsController.getEmptiesReport);
