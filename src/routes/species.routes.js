import express from 'express';
import * as speciesController from '../controllers/species.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { createUploadMiddleware } from '../middleware/upload.middleware.js';

const router = express.Router();

// Public / App (Search)
// Get all species
router.all('/list', speciesController.getAll);

// Get details of a specific species
router.post('/details', speciesController.getById);

// Admin
// Add a new species
router.post('/add', authMiddleware, roleMiddleware(['super_admin', 'admin']), createUploadMiddleware('species').single('species_image'), speciesController.create);

// Update an existing species
router.put('/update', authMiddleware, roleMiddleware(['super_admin', 'admin']), createUploadMiddleware('species').single('species_image'), speciesController.update);

// Delete a species
router.delete('/delete', authMiddleware, roleMiddleware(['super_admin', 'admin']), speciesController.remove);

export default router;
