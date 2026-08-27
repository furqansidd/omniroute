import { Router } from 'express';
import { RiderController } from './rider.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

export const riderRouter = Router();

riderRouter.use(authenticateToken);

// Rider Mobile APIs
riderRouter.get('/rider/route', RiderController.getTodayRoute);
riderRouter.get('/rider/customers/:customerId', RiderController.getCustomerDetails);
