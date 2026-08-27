import { Router } from 'express';
import { CustomerController } from './customer.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const customerRouter = Router();

customerRouter.use(authenticateToken);

customerRouter.get('/', requirePermission('customers', 'read'), CustomerController.list);
customerRouter.get('/:id', requirePermission('customers', 'read'), CustomerController.getById);
customerRouter.post('/', requirePermission('customers', 'create'), CustomerController.create);
customerRouter.put('/:id', requirePermission('customers', 'update'), CustomerController.update);
customerRouter.delete('/:id', requirePermission('customers', 'delete'), CustomerController.delete);

customerRouter.post('/:id/rates', requirePermission('customers', 'update'), CustomerController.setCustomRate);
customerRouter.post('/:id/deposits', requirePermission('customers', 'update'), CustomerController.adjustSecurityDeposit);
