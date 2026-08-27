import { Router } from 'express';
import { FinanceController } from './finance.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const financeRouter = Router();

financeRouter.use(authenticateToken);

// Vouchers CRUD & Receipts
financeRouter.get('/finance/overview', requirePermission('finance', 'read'), FinanceController.getFinancialOverview);
financeRouter.get('/finance/vouchers', requirePermission('finance', 'read'), FinanceController.getVouchers);
financeRouter.post('/finance/vouchers', requirePermission('finance', 'create'), FinanceController.createVoucher);

// Customer Statement Ledgers
financeRouter.get('/finance/customer-ledger/:customerId', requirePermission('finance', 'read'), FinanceController.getCustomerLedger);

// General Ledger Audit Log
financeRouter.get('/finance/general-ledger', requirePermission('finance', 'read'), FinanceController.getGeneralLedger);

// Reports: Profit & Loss Statement
financeRouter.get('/finance/pnl', requirePermission('reports', 'read'), FinanceController.getPnLReport);
