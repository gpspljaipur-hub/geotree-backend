import express from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';

const router = express.Router();
const admin = roleMiddleware(['super_admin', 'admin', 'finance']);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                     PAYMENT MODULE ROUTES                               ║
// ║  Base Path: /api/payment                                                ║
// ╠═══════════════════════════════════════════════════════════════════════════╣
// ║                                                                         ║
// ║  USER ROUTES                                                            ║
// ║  POST /initiate          — Create Razorpay order for a plantation       ║
// ║  POST /confirm           — Verify payment signature → update status     ║
// ║  POST /plantation-status — Poll payment & plantation status             ║
// ║                                                                         ║
// ║  ADMIN ROUTES                                                           ║
// ║  POST /list              — All transactions (paginated, filterable)     ║
// ║  GET  /stats             — Revenue & transaction counts                 ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// ── USER / APP ROUTES ────────────────────────────────────────────────────────

// POST /api/payment/initiate
// Create a Razorpay order. Returns razorpay_order_id + razorpay_key_id for SDK.
// Body: { plantation_id } OR { order_id } OR { amount } (last resort fallback)
router.post('/initiate', decryptionMiddleware, authMiddleware, paymentController.createOrder);

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
router.post('/list', decryptionMiddleware, authMiddleware, admin, paymentController.getAllPayments);

// GET /api/payment/stats
// Revenue summary: total collected, pending, failed counts.
router.get('/stats', authMiddleware, admin, paymentController.getPaymentStats);

export default router;
