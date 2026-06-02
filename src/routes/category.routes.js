import express from 'express';
import * as categoryController from '../controllers/category.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();

// Get list of categories
router.all('/list', decryptionMiddleware, categoryController.getCategoryList);

// Add a new category
router.post('/add', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), categoryController.uploadCategoryImageMiddleware, categoryController.addCategory);
// router.post('/add', decryptionMiddleware, categoryController.uploadCategoryImageMiddleware, categoryController.addCategory);

// Update an existing category
router.put('/update', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), categoryController.uploadCategoryImageMiddleware, categoryController.updateCategory);

// Delete a category
router.delete('/delete', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), categoryController.deleteCategory);

export default router;
