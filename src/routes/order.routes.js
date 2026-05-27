import express from 'express';
import * as orderController from '../controllers/order.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { body } from 'express-validator';
import validate from '../middleware/validate.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();

// --- User Routes ---
// Create Order
router.post('/', decryptionMiddleware, [
    authMiddleware,
    body('user_id').isMongoId().withMessage('Valid User ID required'),
    body('amount').isNumeric().withMessage('Amount must be number'),
    body('trees_count').isInt({ min: 1 }).withMessage('At least 1 tree required'),
    validate
], orderController.createOrder);

// Get My Orders
router.post('/user/list', decryptionMiddleware, authMiddleware, orderController.getUserOrders);

// --- Admin Routes ---
// List All Orders
router.post('/list', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin', 'finance', 'field', 'verification']), orderController.getAllOrders);

// Get Single Order Detail
router.post('/details', decryptionMiddleware, authMiddleware, orderController.getOrderById);

// Update Status (Assign Team, Complete)
router.put('/status', decryptionMiddleware, [
    authMiddleware,
    roleMiddleware(['super_admin', 'admin', 'field', 'verification']),
    body('order_status').optional().isIn(['Pending', 'Paid', 'Assigned', 'Executed', 'Verified', 'Completed', 'Cancelled']),
    validate
], orderController.updateOrderStatus);

// Delete Order
router.delete('/delete', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), orderController.deleteOrder);

export default router;
