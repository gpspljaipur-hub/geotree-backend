import express from 'express';
import * as verificationController from '../controllers/verification.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';
import audit from '../middleware/audit.middleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(['verification', 'super_admin']));

// Get Pending Verifications
router.post('/list', decryptionMiddleware, verificationController.getPendingVerifications);

// Verify Order
router.put('/verify', decryptionMiddleware, audit('Verification', 'VERIFY_ORDER'), verificationController.verifyOrder);

export default router;
