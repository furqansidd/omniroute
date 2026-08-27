import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { identifier, password, tenantId } = req.body;
      if (!identifier || !password) {
        res.status(400).json({ success: false, error: 'Email/Phone and Password are required' });
        return;
      }

      const result = await AuthService.login(identifier, password, tenantId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Login failed' });
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ success: false, error: 'Refresh token required' });
        return;
      }

      const result = await AuthService.refreshToken(refreshToken);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(401).json({ success: false, error: error.message || 'Token refresh failed' });
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      await AuthService.logout(refreshToken);
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Logout failed' });
    }
  }

  static async riderSignup(req: Request, res: Response) {
    try {
      const { name, phone, email, password, companyName } = req.body;
      const result = await AuthService.registerRider({ name, phone, email, password, companyName });
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Rider registration failed' });
    }
  }

  static async getMe(req: Request, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const result = await AuthService.getMe(req.user.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Failed to fetch user' });
    }
  }
}
