import express from 'express';
import * as profileController from '../controllers/profile.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();

// Get user profile
router.post('/details', decryptionMiddleware, authMiddleware, profileController.getProfile);

// Update user profile
router.put('/update', authMiddleware, profileController.uploadMiddleware, decryptionMiddleware, profileController.updateProfile);

// Upload profile image
// AUTH MUST run first to validate token before Multer saves file to disk
// NO decryptionMiddleware - it interferes with FormData
router.post('/upload-image', authMiddleware, profileController.uploadMiddleware, profileController.uploadProfileImage);

export default router;
