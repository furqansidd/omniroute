import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/login', AuthController.login);
authRouter.post('/rider-signup', AuthController.riderSignup);
authRouter.post('/refresh', AuthController.refresh);
authRouter.post('/logout', AuthController.logout);
authRouter.get('/me', authenticateToken, AuthController.getMe);
