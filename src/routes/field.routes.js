import express from 'express';
import * as fieldController from '../controllers/field.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { createUploadMiddleware } from '../middleware/upload.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';
import audit from '../middleware/audit.middleware.js';

const router = express.Router();

// Routes accessible by Field Admins
router.use(authMiddleware);
router.use(roleMiddleware(['field', 'super_admin'])); // Allow super_admin to view too

// Get Assignments
router.post('/assignments', decryptionMiddleware, fieldController.getMyAssignments);

// Update Execution Result (with Image)
// Moving orderId from params to body
router.put('/execute', createUploadMiddleware('field').single('image'), decryptionMiddleware, audit('Field', 'EXECUTION_UPDATE'), fieldController.updateExecution);

export default router;
