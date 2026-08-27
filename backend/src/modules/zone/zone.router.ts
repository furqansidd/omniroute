import { Router } from 'express';
import { ZoneController } from './zone.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const zoneRouter = Router();

zoneRouter.use(authenticateToken);

// Zones CRUD
zoneRouter.get('/zones', requirePermission('zones', 'read'), ZoneController.listZones);
zoneRouter.post('/zones', requirePermission('zones', 'create'), ZoneController.createZone);
zoneRouter.put('/zones/:id', requirePermission('zones', 'update'), ZoneController.updateZone);
zoneRouter.delete('/zones/:id', requirePermission('zones', 'delete'), ZoneController.deleteZone);

// Routes CRUD
zoneRouter.get('/routes', requirePermission('routes', 'read'), ZoneController.listRoutes);
zoneRouter.post('/routes', requirePermission('routes', 'create'), ZoneController.createRoute);
zoneRouter.delete('/routes/:id', requirePermission('routes', 'delete'), ZoneController.deleteRoute);

// Visit Plans
zoneRouter.get('/visit-plans', requirePermission('routes', 'read'), ZoneController.listVisitPlans);
zoneRouter.post('/visit-plans', requirePermission('routes', 'create'), ZoneController.createVisitPlan);
