import express from 'express';
import * as adminUiController from '../controllers/admin.ui.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';

const router = express.Router();

// All routes here should be protected and only accessible by admins
router.use(authMiddleware);
router.use(roleMiddleware(['super_admin', 'admin']));

// Get all models
router.get('/models', adminUiController.getModels);

// Get records for a specific model
router.get('/models/:modelName', adminUiController.getModelRecords);
router.post('/models/:modelName/list', adminUiController.getModelRecords);

// Get a single record
router.get('/models/:modelName/:id', adminUiController.getRecordById);

// Create a new record
router.post('/models/:modelName', adminUiController.createRecord);

// Update a record
router.put('/models/:modelName/:id', adminUiController.updateRecord);

// Delete a record
router.delete('/models/:modelName/:id', adminUiController.deleteRecord);

export default router;
