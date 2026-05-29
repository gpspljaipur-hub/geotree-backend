import express from 'express';
import * as stateController from '../controllers/state.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { body, check } from 'express-validator';
import validate from '../middleware/validate.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();

// State Routes
// Get State API
router.all('/list', decryptionMiddleware, stateController.getStateList);
router.all('/hierarchy', decryptionMiddleware, stateController.getHierarchy);

// Add State API
router.post('/add', decryptionMiddleware, [
    authMiddleware,
    roleMiddleware(['super_admin', 'admin']),
    stateController.uploadStateImageMiddleware,
    decryptionMiddleware,
    body('state_name').trim().notEmpty().withMessage('State name is required'),
    validate
], stateController.addState);

// Update an existing state
router.put('/update', [
    authMiddleware,
    roleMiddleware(['super_admin', 'admin']),
    stateController.uploadStateImageMiddleware,
    decryptionMiddleware,
    check('id').notEmpty().withMessage('ID is required'),
    body('name').optional().trim().notEmpty().withMessage('State name cannot be empty'),
    validate
], stateController.updateState);

// Delete State API
router.delete('/delete', decryptionMiddleware, [
    authMiddleware,
    roleMiddleware(['super_admin', 'admin']),
    check('id').notEmpty().withMessage('ID is required'),
    validate
], stateController.deleteState);

export default router;
