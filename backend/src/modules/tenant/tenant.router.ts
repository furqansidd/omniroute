import { Router } from 'express';
import { TenantController } from './tenant.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const tenantRouter = Router();

// Public onboarding endpoints
tenantRouter.post('/onboard', TenantController.onboard);
tenantRouter.get('/templates/:industryType', TenantController.getTemplates);

// Protected tenant management
tenantRouter.get('/', authenticateToken, requirePermission('tenants', 'read'), TenantController.listTenants);
