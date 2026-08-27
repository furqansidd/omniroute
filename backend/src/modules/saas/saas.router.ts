import { Router } from 'express';
import { SaasController } from './saas.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

export const saasRouter = Router();

saasRouter.use(authenticateToken);

// SaaS Subscription & Metering Endpoints
saasRouter.get('/saas/metering', SaasController.getTenantMetering);
saasRouter.put('/saas/tier', SaasController.updateSubscriptionTier);
saasRouter.get('/saas/platform-overview', SaasController.getAllTenantsMetering);
