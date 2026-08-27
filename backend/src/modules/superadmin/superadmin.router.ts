import { Router } from 'express';
import { SuperAdminController } from './superadmin.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = Router();
const controller = new SuperAdminController();

router.use(authenticateToken as any);

router.get('/stats', (req, res) => controller.getDashboardStats(req, res));
router.get('/owners', (req, res) => controller.getBusinessOwners(req, res));
router.put('/owners/:tenantId/status', (req, res) => controller.updateOwnerStatus(req, res));
router.put('/owners/:tenantId/plan', (req, res) => controller.updateOwnerPlan(req, res));
router.get('/payments', (req, res) => controller.getSubscriptionPayments(req, res));
router.post('/payments', (req, res) => controller.recordSubscriptionPayment(req, res));
router.post('/owners/:tenantId/reject', (req, res) => controller.rejectOwnerRegistration(req, res));

export default router;
