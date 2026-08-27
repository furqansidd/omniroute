import { Router } from 'express';
import { DeliveryController } from './delivery.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

export const deliveryRouter = Router();

deliveryRouter.use(authenticateToken);

// Delivery Completion & Execution
deliveryRouter.post('/deliveries/:id/complete', DeliveryController.completeDelivery);
deliveryRouter.get('/deliveries', DeliveryController.listDeliveries);
