import express from 'express';
import * as certificateController from '../controllers/certificate.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();

// List All Certificates (Admin)
// Get list of all certificates
// Change to POST to allow ID in body
// Get list of all certificates
router.post('/list', decryptionMiddleware, authMiddleware, certificateController.getAllCertificates);

// Get list of certificates for an app user
router.post('/user-list', decryptionMiddleware, authMiddleware, certificateController.getUserCertificates);

// Change to POST to allow ID in body
// Get certificate details
router.post('/details', decryptionMiddleware, authMiddleware, certificateController.getCertificateDetails);

// Change to POST to allow ID in body
// Download certificate
router.post('/download', decryptionMiddleware, authMiddleware, certificateController.downloadCertificate);

// Generate a new certificate
router.post('/generate', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin', 'field']), certificateController.createCertificate);

// Update a certificate
router.put('/update', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), certificateController.updateCertificate);

// Delete a certificate
router.delete('/delete', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), certificateController.deleteCertificate);

// View Certificate (HTML) - Public or Protected? usually public for sharing, but let's keep it open for now or check if user wants auth. 
// User said "make a html page for it". Usually certificate links are sharable.
router.get('/view/:certificate_id', certificateController.viewCertificate);

export default router;
