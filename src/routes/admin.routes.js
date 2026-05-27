import express from 'express';
import * as authController from '../controllers/adminAuth.controller.js'; // Points to src/controllers (merged)
import * as adminController from '../controllers/admin.controller.js';
import authMiddleware from '../middleware/auth.middleware.js'; // Points to src/middleware
import roleMiddleware from '../middleware/role.middleware.js';
import { body } from 'express-validator';
import validate from '../middleware/validate.middleware.js';
import upload, { createUploadMiddleware } from '../middleware/upload.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';
import audit from '../middleware/audit.middleware.js';

// import rateLimit from 'express-rate-limit';

const router = express.Router();
// //login min
// const loginLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 5, // 5 attempts per IP
//     message: { status: false, message: "Too many login attempts, please try again after 15 minutes" },
//     standardHeaders: true,
//     legacyHeaders: false,
// });

// Public routes
// Admin Login
router.post('/auth/login', decryptionMiddleware, [
    body('email').trim().toLowerCase().isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
], authController.adminLogin);

// Forgot Password
router.post('/auth/forgot-password', decryptionMiddleware, [
    body('email').trim().toLowerCase().isEmail().withMessage('Valid email is required'),
    validate
], authController.forgotPassword);

// Verify OTP
router.post('/auth/verify-otp', decryptionMiddleware, [
    body('email').trim().toLowerCase().isEmail().withMessage('Valid email is required'),
    body('otp').notEmpty().withMessage('OTP is required').custom(val => val.toString().trim().length === 6).withMessage('OTP must be exactly 6 digits'),
    validate
], authController.verifyOTP);

// Reset Password
router.post('/auth/reset-password', decryptionMiddleware, [
    body('email').trim().toLowerCase().isEmail().withMessage('Valid email is required'),
    body('otp').notEmpty().withMessage('OTP is required').custom(val => val.toString().trim().length === 6).withMessage('OTP must be exactly 6 digits'),
    body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    validate
], authController.resetPassword);
// Logout
router.post('/auth/logout', authMiddleware, authController.adminLogout);

// Protected routes (Super Admin only for user management)
// Get Dashboard Stats
router.post('/stats', decryptionMiddleware, authMiddleware, adminController.getDashboardStats); // Dashboard Overview

// Get list of admins
router.post('/admins/list', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin']), adminController.getAllAdmins);

// Get list of regular users
router.post('/users/list', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), adminController.getAllUsers);

// Add a new admin/user
router.post('/users', decryptionMiddleware, [
    authMiddleware,
    roleMiddleware(['super_admin']),
    createUploadMiddleware('admins').single('image'),
    audit('Admin'), // Log creation
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 chars long'),
    body('role').optional().customSanitizer(v => v.toLowerCase()).isIn(['super_admin', 'admin', 'finance', 'field', 'verification', 'content']).withMessage('Invalid role'),
    validate
], adminController.addAdmin);

// Update an admin
router.put('/admins/update', decryptionMiddleware, [
    authMiddleware,
    roleMiddleware(['super_admin']),
    createUploadMiddleware('admins').single('image'),
    audit('Admin'), // Log updates
    body('email').optional().isEmail(),
    body('role').optional().customSanitizer(v => v.toLowerCase()).isIn(['super_admin', 'admin', 'finance', 'field', 'verification', 'content']).withMessage('Invalid role'),
    validate
], adminController.updateAdmin);

// Delete an admin
router.delete('/admins/delete', decryptionMiddleware, [
    authMiddleware,
    roleMiddleware(['super_admin']),
    audit('Admin'),
    validate
], adminController.deleteAdmin);

// Update a regular user
router.put('/users/update', decryptionMiddleware, [
    authMiddleware,
    roleMiddleware(['super_admin', 'admin']),
    createUploadMiddleware('profile').single('profile_image'),
    audit('User'),
    validate
], adminController.updateUser);

// Delete a regular user
router.delete('/users/delete', decryptionMiddleware, [
    authMiddleware,
    roleMiddleware(['super_admin', 'admin']),
    audit('User'),
    validate
], adminController.deleteUser);

// Profile Management
// Get profile details
router.post('/profile', decryptionMiddleware, authMiddleware, adminController.getProfile);

// Update password
router.put('/profile/password', decryptionMiddleware, [
    authMiddleware,
    audit('Admin', 'PASSWORD_CHANGE'), // Log password change
    body('old_password').notEmpty(),
    body('new_password').isLength({ min: 6 }),
    validate
], adminController.updatePassword);

// Roles & Permissions Management
router.get('/permissions/list', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin']), adminController.getPermissions);

router.post('/permissions/update', decryptionMiddleware, [
    authMiddleware,
    roleMiddleware(['super_admin']),
    audit('Admin', 'PERMISSIONS_UPDATE'),
    body('permissions').notEmpty().withMessage('Permissions data is required'),
    validate
], adminController.updatePermissions);

router.get('/roles/metadata', decryptionMiddleware, authMiddleware, adminController.getRolesMetadata);

export default router;
