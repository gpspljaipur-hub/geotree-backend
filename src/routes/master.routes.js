import express from 'express';
import * as nurseryController from '../controllers/nursery.controller.js';

import { createUploadMiddleware } from '../middleware/upload.middleware.js';

import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();

// Nursery Routes
// Get list of nurseries
router.all('/nursery/list', nurseryController.getNurseryList);

// Add a new nursery
router.post('/nursery/add', createUploadMiddleware('nursery').single('nursery_image'), decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), nurseryController.addNursery);

// Update a nursery
router.put('/nursery/update', createUploadMiddleware('nursery').single('nursery_image'), decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), nurseryController.updateNursery);

// Delete a nursery
router.delete('/nursery/delete', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), nurseryController.deleteNursery);

export default router;
