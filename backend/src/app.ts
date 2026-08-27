import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/auth.router.js';
import { rbacRouter } from './modules/rbac/rbac.router.js';
import { tenantRouter } from './modules/tenant/tenant.router.js';
import { customerRouter } from './modules/customer/customer.router.js';
import { productRouter } from './modules/product/product.router.js';
import { zoneRouter } from './modules/zone/zone.router.js';
import { orderRouter } from './modules/order/order.router.js';
import { riderRouter } from './modules/rider/rider.router.js';
import { deliveryRouter } from './modules/delivery/delivery.router.js';
import { emptiesRouter } from './modules/empties/empties.router.js';
import { trackboardRouter } from './modules/trackboard/trackboard.router.js';
import { billingRouter } from './modules/billing/billing.router.js';
import { financeRouter } from './modules/finance/finance.router.js';
import { notificationRouter } from './modules/notifications/notification.router.js';
import { sleepingRouter } from './modules/sleeping/sleeping.router.js';
import { breakageRouter } from './modules/breakage/breakage.router.js';
import { reportsRouter } from './modules/reports/reports.router.js';
import { printerRouter } from './modules/printer/printer.router.js';
import { productionRouter } from './modules/production/production.router.js';
import { saasRouter } from './modules/saas/saas.router.js';
import superadminRouter from './modules/superadmin/superadmin.router.js';

import { purchaseRouter } from './modules/purchase/purchase.router.js';

export const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API v1 Routers
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/rbac', rbacRouter);
app.use('/api/v1/tenants', tenantRouter);
app.use('/api/v1/customers', customerRouter);
app.use('/api/v1/purchase', purchaseRouter);
app.use('/api/v1', productRouter);
app.use('/api/v1', zoneRouter);
app.use('/api/v1', orderRouter);
app.use('/api/v1', riderRouter);
app.use('/api/v1', deliveryRouter);
app.use('/api/v1', emptiesRouter);
app.use('/api/v1', trackboardRouter);
app.use('/api/v1', billingRouter);
app.use('/api/v1', financeRouter);
app.use('/api/v1', notificationRouter);
app.use('/api/v1', sleepingRouter);
app.use('/api/v1', breakageRouter);
app.use('/api/v1', reportsRouter);
app.use('/api/v1', printerRouter);
app.use('/api/v1', productionRouter);
app.use('/api/v1', saasRouter);
app.use('/api/v1/superadmin', superadminRouter);

// Centralized error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});
