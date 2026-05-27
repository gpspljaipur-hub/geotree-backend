import express from 'express';
import * as signupController from '../controllers/signup.controller.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();

// Public routes for mobile app authentication
// Check mobile number for signup/login
router.post('/check-number', decryptionMiddleware, signupController.checkNumber);

// Verify OTP
router.post('/verify-otp', decryptionMiddleware, signupController.verifyOTP);

export default router;
