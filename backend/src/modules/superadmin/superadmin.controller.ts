import { Request, Response } from 'express';
import { SuperAdminService } from './superadmin.service.js';

const superAdminService = new SuperAdminService();

export class SuperAdminController {
  async getDashboardStats(req: Request, res: Response) {
    try {
      const stats = await superAdminService.getSuperAdminDashboardStats();
      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to fetch super admin dashboard statistics'
      });
    }
  }

  async getBusinessOwners(req: Request, res: Response) {
    try {
      const { search, industry, tier, status } = req.query;
      const owners = await superAdminService.getBusinessOwners({
        search: search as string,
        industry: industry as string,
        tier: tier as string,
        status: status as string
      });

      return res.status(200).json({
        success: true,
        data: owners
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to fetch business owners directory'
      });
    }
  }

  async updateOwnerStatus(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ success: false, error: 'Status is required' });
      }

      const updated = await superAdminService.updateOwnerStatus(tenantId as string, status);
      return res.status(200).json({
        success: true,
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to update owner status'
      });
    }
  }

  async updateOwnerPlan(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
      const { planTier } = req.body;

      if (!planTier) {
        return res.status(400).json({ success: false, error: 'Subscription planTier is required' });
      }

      const updated = await superAdminService.updateOwnerPlan(tenantId as string, planTier);
      return res.status(200).json({
        success: true,
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to update owner subscription plan'
      });
    }
  }

  async getSubscriptionPayments(req: Request, res: Response) {
    try {
      const { tenantId } = req.query;
      const payments = await superAdminService.getSubscriptionPayments(tenantId as string);
      return res.status(200).json({
        success: true,
        data: payments
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to fetch subscription payments log'
      });
    }
  }

  async recordSubscriptionPayment(req: Request, res: Response) {
    try {
      const { tenantId, amount, planTier, paymentMethod, referenceNumber, notes } = req.body;

      if (!tenantId || amount === undefined) {
        return res.status(400).json({
          success: false,
          error: 'tenantId and amount are required to record subscription payment'
        });
      }

      const payment = await superAdminService.recordSubscriptionPayment({
        tenantId,
        amount: Number(amount),
        planTier,
        paymentMethod,
        referenceNumber,
        notes
      });

      return res.status(201).json({
        success: true,
        data: payment
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to record subscription payment'
      });
    }
  }

  async rejectOwnerRegistration(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
      const { reason } = req.body;

      const updated = await superAdminService.rejectOwnerRegistration(tenantId as string, reason);
      return res.status(200).json({
        success: true,
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to reject registration request'
      });
    }
  }
}
