import express from 'express';
import * as reportController from '../controllers/report.controller.js';

import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();

// Export orders report
router.post('/export', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin', 'finance']), reportController.exportOrders);

export default router;
