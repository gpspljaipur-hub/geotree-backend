import express from 'express';
import * as carbonController from '../controllers/carbon.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';
import { createUploadMiddleware } from '../middleware/upload.middleware.js';

const router = express.Router();

// --- Available Controller Functions ---

// Calculate & Submit
// Calculate carbon footprint
router.post('/calculate', decryptionMiddleware, authMiddleware, carbonController.submitCarbon);

// Get Results & History
// Get calculation result
router.post('/result', decryptionMiddleware, authMiddleware, carbonController.getCarbonResult);

// Get calculation history
router.post('/history', decryptionMiddleware, authMiddleware, carbonController.getCarbonHistory);

// Reference Data (Types)
// Get transport types
router.get('/transport-types', carbonController.getTransportTypeList);

// Get electricity types
router.get('/electricity-types', carbonController.getElectricityList);

// Get food types
router.get('/food-types', carbonController.getFoodTypeList);

// Admin / Init
// Bulk add carbon types
router.post('/types/bulk-add', decryptionMiddleware, authMiddleware, carbonController.addAllTypes);




// Emission Factors CRUD
router.get('/emission-factors', carbonController.getEmissionFactors);
router.post('/emission-factors', decryptionMiddleware, carbonController.getEmissionFactors);

router.post('/emission-factors/list', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), carbonController.getEmissionFactors);

router.post('/emission-factors/add', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), createUploadMiddleware('carbon').single('image'), carbonController.addEmissionFactor);
router.put('/emission-factors/update', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), createUploadMiddleware('carbon').single('image'), carbonController.updateEmissionFactor);
router.delete('/emission-factors/delete', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), carbonController.deleteEmissionFactor);

// Offset Factors CRUD
router.post('/offset-factors/list', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), carbonController.getOffsetFactors);
router.post('/offset-factors/add', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), carbonController.addOffsetFactor);
router.put('/offset-factors/update', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), carbonController.updateOffsetFactor);
router.delete('/offset-factors/delete', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), carbonController.deleteOffsetFactor);

export default router;
