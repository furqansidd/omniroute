import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

export const notificationRouter = Router();

notificationRouter.use(authenticateToken);

// Notification templates
notificationRouter.get('/notifications/templates', requirePermission('notifications', 'read'), NotificationController.getTemplates);
notificationRouter.post('/notifications/templates', requirePermission('notifications', 'create'), NotificationController.upsertTemplate);

// Trigger automated event notification & manual direct dispatch
notificationRouter.post('/notifications/trigger', requirePermission('notifications', 'create'), NotificationController.triggerNotification);
notificationRouter.post('/notifications/send', requirePermission('notifications', 'create'), NotificationController.sendDirectNotification);

// Notification audit logs & stats
notificationRouter.get('/notifications/logs', requirePermission('notifications', 'read'), NotificationController.getMessageLogs);
notificationRouter.get('/notifications/stats', requirePermission('notifications', 'read'), NotificationController.getNotificationStats);
