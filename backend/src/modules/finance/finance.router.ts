import { Router } from 'express';
import { FinanceController } from './finance.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const financeRouter = Router();

financeRouter.use(authenticateToken);

// Vouchers CRUD & Overview
financeRouter.get('/finance/overview', requirePermission('finance', 'read'), FinanceController.getFinancialOverview);
financeRouter.get('/finance/vouchers', requirePermission('finance', 'read'), FinanceController.getVouchers);
financeRouter.post('/finance/vouchers', requirePermission('finance', 'create'), FinanceController.createVoucher);

// Rider Cash Holdings & Settlements
financeRouter.get('/finance/rider-holdings', requirePermission('finance', 'read'), FinanceController.getRiderCashHoldings);
financeRouter.post('/finance/rider-handover', requirePermission('finance', 'create'), FinanceController.settleRiderCashHandover);

// 3-Way Statement Ledgers
financeRouter.get('/finance/customer-ledger/:customerId', requirePermission('finance', 'read'), FinanceController.getCustomerLedger);
financeRouter.get('/finance/vendor-ledger/:vendorId', requirePermission('finance', 'read'), FinanceController.getVendorLedger);
financeRouter.get('/finance/rider-ledger/:riderId', requirePermission('finance', 'read'), FinanceController.getRiderLedger);

// General Ledger Audit Log
financeRouter.get('/finance/general-ledger', requirePermission('finance', 'read'), FinanceController.getGeneralLedger);

// Reports: Profit & Loss Statement
financeRouter.get('/finance/pnl', requirePermission('reports', 'read'), FinanceController.getPnLReport);
