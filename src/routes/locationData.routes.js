import express from 'express';
import * as locationController from '../controllers/locationData.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Multer config for excel upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/uploads/temp';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `location-import-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// Public/Shared dropdown routes
router.get('/states', locationController.getStates);
router.get('/districts', locationController.getDistricts);
router.get('/blocks', locationController.getBlocks);
router.get('/gps', locationController.getGPs);
router.get('/villages', locationController.getVillages);

// Admin only: Upload Excel
router.post('/upload-excel', [
    authMiddleware,
    roleMiddleware(['super_admin', 'admin']),
    upload.single('file')
], locationController.uploadLocationExcel);

export default router;
