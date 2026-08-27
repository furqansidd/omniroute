import { Router } from 'express';
import { SleepingController } from './sleeping.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const sleepingRouter = Router();

sleepingRouter.use(authenticateToken);

// Churn radar & stats
sleepingRouter.get('/sleeping/radar', requirePermission('customers', 'read'), SleepingController.getSleepingRadar);
sleepingRouter.get('/sleeping/stats', requirePermission('customers', 'read'), SleepingController.getSleepingStats);
sleepingRouter.get('/sleeping/customers', requirePermission('customers', 'read'), SleepingController.getSleepingCustomers);

// Trigger automated detection sweep
sleepingRouter.post('/sleeping/detect', requirePermission('customers', 'update'), SleepingController.detectSleepingCustomers);

// Win-back actions & reactivation
sleepingRouter.post('/sleeping/reactivate/:id', requirePermission('customers', 'update'), SleepingController.reactivateCustomer);
sleepingRouter.post('/sleeping/reengage/:id', requirePermission('customers', 'update'), SleepingController.triggerReengagementPromo);
