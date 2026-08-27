import { Router } from 'express';
import { TrackboardController } from './trackboard.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

export const trackboardRouter = Router();

trackboardRouter.use(authenticateToken);

// GPS Ingestion & Live Trackboard APIs
trackboardRouter.post('/trackboard/pings', TrackboardController.recordPing);
trackboardRouter.get('/trackboard/live', TrackboardController.getLiveRiders);
trackboardRouter.get('/trackboard/history/:riderId', TrackboardController.getRiderHistory);
