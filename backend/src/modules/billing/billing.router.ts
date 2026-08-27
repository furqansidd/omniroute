import { Router } from 'express';
import { BillingController } from './billing.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const billingRouter = Router();

billingRouter.use(authenticateToken);

// Billing summary & invoices
billingRouter.get('/billing/summary', requirePermission('finance', 'read'), BillingController.getBillingSummary);
billingRouter.post('/billing/generate', requirePermission('finance', 'create'), BillingController.generateBatchInvoices);

billingRouter.get('/billing/invoices', requirePermission('finance', 'read'), BillingController.getInvoices);
billingRouter.get('/billing/invoices/:id', requirePermission('finance', 'read'), BillingController.getInvoiceById);
billingRouter.post('/billing/invoices', requirePermission('finance', 'create'), BillingController.createManualInvoice);
billingRouter.patch('/billing/invoices/:id/status', requirePermission('finance', 'update'), BillingController.updateInvoiceStatus);
billingRouter.delete('/billing/invoices/:id', requirePermission('finance', 'delete'), BillingController.cancelInvoice);
