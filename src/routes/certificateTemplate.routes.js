import express from 'express';
import * as certController from '../controllers/certificateTemplate.controller.js';
import { createUploadMiddleware } from '../middleware/upload.middleware.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();

// Get list of certificate templates
router.all('/list', certController.getTemplateList);

// Get single template
router.get('/get/:id', certController.getTemplateById);

// Add a new certificate template
router.post('/add', createUploadMiddleware('template').fields([
    { name: 'previewImage', maxCount: 1 },
    { name: 'background_image', maxCount: 1 }, // Alias
    { name: 'template_file', maxCount: 1 },
    { name: 'html_template', maxCount: 1 }      // Alias if sent as file
]), decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), certController.addTemplate);

// Update a certificate template
router.put('/update', createUploadMiddleware('template').fields([
    { name: 'previewImage', maxCount: 1 },
    { name: 'background_image', maxCount: 1 }, // Alias
    { name: 'template_file', maxCount: 1 },
    { name: 'html_template', maxCount: 1 }      // Alias if sent as file
]), decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), certController.updateTemplate);

// Delete a certificate template
router.delete('/delete', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), certController.deleteTemplate);

export default router;
