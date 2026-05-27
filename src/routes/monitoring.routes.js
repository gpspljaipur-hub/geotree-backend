import express from 'express';
import * as monitoringController from '../controllers/monitoring.controller.js';
import { createUploadMiddleware } from '../middleware/upload.middleware.js';

const router = express.Router();

// Get monitoring data
router.get('/data', monitoringController.getMonitoringData);

// Add a new monitoring record
router.post('/add', createUploadMiddleware('monitoring').array('media', 5), monitoringController.addMonitoringRecord);

// Update a monitoring record
router.put('/update', monitoringController.updateMonitoringRecord);

// Delete a monitoring record
router.delete('/delete', monitoringController.deleteMonitoringRecord);

export default router;
