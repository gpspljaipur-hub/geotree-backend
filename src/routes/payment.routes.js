import express from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();
const admin = roleMiddleware(['super_admin', 'admin', 'finance']);

router.post('/initiate', decryptionMiddleware, paymentController.createOrder);

// POST /api/payment/confirm
// Verify payment after Razorpay SDK completes. Also handles Razorpay webhooks.
// App body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Webhook:  Razorpay sends with x-razorpay-signature header
router.post('/confirm', decryptionMiddleware, paymentController.verifypayment);

// POST /api/payment/plantation-status
// Poll the current payment_status + plantation_status of a plantation.
// Useful for showing a "Payment Processing..." screen while waiting for webhook.
// Body: { plantation_id }
router.post('/plantation-status', decryptionMiddleware, authMiddleware, paymentController.getPlantationPaymentStatus);

// ── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// POST /api/payment/list
// List all transactions with pagination. Filterable by status and user_id.
router.post('/list', decryptionMiddleware, authMiddleware, paymentController.getAllPayments);

// GET /api/payment/stats
// Revenue summary: total collected, pending, failed counts.
router.get('/stats', authMiddleware, paymentController.getPaymentStats);

export default router;
