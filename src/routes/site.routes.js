import express from 'express';
import * as siteController from '../controllers/site.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';
import { boundaryUpload, siteImageUpload } from '../middleware/upload.middleware.js';

const router = express.Router();

// Public/Authenticated access
router.all('/list', decryptionMiddleware, siteController.getSiteList);

// Admin only access
router.post('/add', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), siteImageUpload.single('site_image'), siteController.addSite);
router.put('/update', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), siteImageUpload.single('site_image'), siteController.updateSite);
router.delete('/delete', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), siteController.deleteSite);

// Boundary Upload
router.post('/upload-boundary', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), boundaryUpload.single('file'), siteController.uploadBoundaryFile);

//
router.all('/sitelist', decryptionMiddleware, siteController.getSiteAllList);
//
router.all('/species-summary', decryptionMiddleware, siteController.getAppSpeciesSummary);
export default router;
