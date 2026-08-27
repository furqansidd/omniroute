import { Router } from 'express';
import { EmptiesController } from './empties.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const emptiesRouter = Router();

emptiesRouter.use(authenticateToken);

// Empties & Container Security Deposit APIs
emptiesRouter.get('/empties/summary', requirePermission('empties', 'read'), EmptiesController.getEmptiesSummary);
emptiesRouter.get('/empties/ledger', requirePermission('empties', 'read'), EmptiesController.getEmptiesLedger);
emptiesRouter.post('/empties/adjust', requirePermission('empties', 'create'), EmptiesController.adjustContainerDeposit);
