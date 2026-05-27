import express from 'express';
import * as auditController from '../controllers/audit.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();

// Get list of audit logs
router.post('/list', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin']), auditController.getLogs);

export default router;
