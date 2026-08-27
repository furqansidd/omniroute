import { Router } from 'express';
import { OrderController } from './order.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const orderRouter = Router();

orderRouter.use(authenticateToken);

// Orders CRUD & Run Generation
orderRouter.get('/orders', requirePermission('orders', 'read'), OrderController.listOrders);
orderRouter.get('/orders/:id', requirePermission('orders', 'read'), OrderController.getOrderById);
orderRouter.post('/orders', requirePermission('orders', 'create'), OrderController.createOrder);
orderRouter.put('/orders/:id/status', requirePermission('orders', 'update'), OrderController.updateOrderStatus);
orderRouter.post('/orders/generate-daily-runs', requirePermission('orders', 'approve'), OrderController.generateDailyRuns);

// Recurring Schedules (Subscriptions)
orderRouter.get('/schedules', requirePermission('orders', 'read'), OrderController.listSchedules);
orderRouter.post('/schedules', requirePermission('orders', 'create'), OrderController.createSchedule);
orderRouter.put('/schedules/:id/status', requirePermission('orders', 'update'), OrderController.updateScheduleStatus);
