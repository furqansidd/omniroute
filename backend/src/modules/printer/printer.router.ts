import { Router } from 'express';
import { PrinterController } from './printer.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

export const printerRouter = Router();

printerRouter.use(authenticateToken);

// Thermal Receipt Generation & ESC/POS Hex Stream
printerRouter.post('/printer/generate', PrinterController.generateReceiptTemplate);

// Receipt Header/Footer Preferences
printerRouter.get('/printer/settings', PrinterController.getPrinterSettings);
printerRouter.put('/printer/settings', PrinterController.updatePrinterSettings);
