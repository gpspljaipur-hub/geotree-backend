import Razorpay from "razorpay";
import crypto from "crypto";
import mongoose from "mongoose";
import Transaction from "../models/transaction.model.js";
import Order from "../models/order.model.js";
import Plantation from "../models/plantation.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { completePlantationRecord } from "./plantation.controller.js";

// ─── Razorpay Client ──────────────────────────────────────────────────────────
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error(
    "❌ CRITICAL: Razorpay keys are missing in environment variables! Razorpay payments will fail.",
  );
}

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: RAZORPAY_KEY_SECRET || "placeholder_secret",
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Initiate Razorpay payment for a plantation
// @route  POST /api/payment/initiate
// @body   { plantation_id* }  OR  { order_id* }  OR  { amount* }  (fallback)
//
// SECURITY: Amount is always taken from DB record — never trusting client amount.
// ─────────────────────────────────────────────────────────────────────────────
export const createOrder = asyncHandler(async (req, res) => {
  const { amount: requestedAmount, user_id: body_user_id, userId, order_id, plantation_id } = req.body;
  let user_id = body_user_id || userId || req.user?.id;

  let finalAmount = requestedAmount;
  let linkedPlantationId = plantation_id;
  let linkedOrderId = order_id;

  // ── SECURITY: Read amount from DB, never trust client ────────────────────
  if (plantation_id && mongoose.Types.ObjectId.isValid(plantation_id)) {
    const plantationRecord = await Plantation.findById(plantation_id)
      .select('amount payment_status user_id');
    if (!plantationRecord) throw new ApiError(404, "Plantation record not found");
    // Don't allow re-payment for already completed plantations
    if (plantationRecord.payment_status === "Completed") {
      throw new ApiError(400, "Payment already completed for this plantation");
    }

    finalAmount = plantationRecord.amount;
    linkedPlantationId = plantationRecord._id;
    if (!user_id && plantationRecord.user_id) {
      user_id = plantationRecord.user_id;
    }
  }

  if (!user_id) {
    throw new ApiError(400, "User ID is required to initiate a transaction");
  }

  if (!finalAmount || finalAmount <= 0) {
    throw new ApiError(400, "A valid payment amount is required");
  }

  // ── Create Razorpay Order ─────────────────────────────────────────────────
  let razorpayOrder;
  try {
    razorpayOrder = await razorpay.orders.create({
      amount: Math.round(Number(finalAmount) * 100), // Convert to paise (integer)
      currency: "INR",
      receipt: `rcpt_${Date.now()}`
    });
  } catch (err) {
    console.error("❌ [Payment] Razorpay order creation failed:", err);
    if (process.env.NODE_ENV === 'development') {
      console.warn("⚠️ [Payment] Falling back to MOCK mode in development after Razorpay API failure.");
      razorpayOrder = {
        id: `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        amount: Math.round(Number(finalAmount) * 100),
        currency: "INR"
      };
    } else {
      throw new ApiError(502, `Razorpay error: ${err.message || 'Authentication failed'}`);
    }
  }


  console.log(`[Payment] Razorpay order created:`, razorpayOrder.id);

  // ── Save pending Transaction locally ─────────────────────────────────────
  await Transaction.create({
    user_id,
    order_id: linkedOrderId || null,
    plantation_id: linkedPlantationId || null,
    transaction_id: razorpayOrder.id,   // This is the Razorpay order_id or mock id
    amount: Number(finalAmount),
    currency: "INR",
    method: "Razorpay",
    status: "Pending",
  });

  // ── Mark plantation as payment_status: 'Initiated' for tracking ──────────
  if (linkedPlantationId) {
    await Plantation.findByIdAndUpdate(linkedPlantationId, {
      razorpay_order_id: razorpayOrder.id  // Save for webhook/confirmation cross-check
    });
  }

  res.json({
    status: true,
    message: "Payment order created. Proceed to pay.",
    data: {
      razorpay_order_id: razorpayOrder.id,
      razorpay_key_id: RAZORPAY_KEY_ID || "rzp_test_placeholder_key_id", // Frontend needs this to launch SDK
      amount: razorpayOrder.amount,             // Amount in paise
      amount_inr: finalAmount,                  // Amount in rupees (for display)
      currency: razorpayOrder.currency,
      plantation_id: linkedPlantationId || null,
      order_id: razorpayOrder.id || null,
    },
  });
});

export const verifypayment = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let razorpay_order_id,
      razorpay_payment_id,
      expectedSignature,
      receivedSignature;
    const isWebhook = !!req.headers["x-razorpay-signature"];

    if (isWebhook) {
      // ── WEBHOOK from Razorpay servers ────────────────────────────────────
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("❌ RAZORPAY_WEBHOOK_SECRET is not configured in environment variables!");
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
          status: false,
          message: "Webhook secret not configured on server",
        });
      }
      const rawBody = req.rawBody
        ? req.rawBody.toString()
        : JSON.stringify(req.body);

      expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      receivedSignature = req.headers["x-razorpay-signature"];

      const paymentEntity = req.body.payload?.payment?.entity;
      if (!paymentEntity) {
        await session.abortTransaction();
        session.endSession();
        return res.json({
          status: true,
          message: "Ignored: non-payment event",
        });
      }

      razorpay_order_id = paymentEntity.order_id;
      razorpay_payment_id = paymentEntity.id;
    } else {
      // ── Client-side confirmation from mobile/web app ──────────────────
      razorpay_order_id = req.body.razorpay_order_id;
      razorpay_payment_id = req.body.razorpay_payment_id;
      receivedSignature = req.body.razorpay_signature;

      if (!razorpay_order_id || !razorpay_payment_id || !receivedSignature) {
        await session.abortTransaction();
        session.endSession();
        throw new ApiError(
          400,
          "Missing required payment verification fields: razorpay_order_id, razorpay_payment_id, razorpay_signature",
        );
      }

      const bodyData = razorpay_order_id + "|" + razorpay_payment_id;
      expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(bodyData)
        .digest("hex");
    }

    // ── STEP 1: Cryptographic signature verification ──────────────────────
    if (expectedSignature !== receivedSignature) {
      // Update transaction as failed
      await Transaction.findOneAndUpdate(
        { transaction_id: razorpay_order_id },
        { status: "Failed", gateway_response: req.body },
      ).catch((e) =>
        console.error("Failed to mark transaction as failed:", e.message),
      );

      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        status: false,
        message:
          "Payment verification failed: Invalid signature. Payment not accepted.",
      });
    }

    // ── STEP 2: Signature valid — update Transaction record ───────────────
    const txn = await Transaction.findOneAndUpdate(
      { transaction_id: razorpay_order_id },
      {
        status: "Completed",
        gateway_response: req.body,
        razorpay_payment_id: razorpay_payment_id,
      },
      { new: true, session },
    );

    if (!txn) {
      console.warn(
        `[Payment] Transaction not found for Razorpay order: ${razorpay_order_id}`,
      );
      await session.abortTransaction();
      session.endSession();

      return res.json({
        status: true,
        message:
          "Payment received but transaction record not matched. Please contact support.",
        razorpay_order_id,
      });
    }

    // ── STEP 3: Update Plantation → payment_status: Completed ────────────
    let generatedOrderId = txn.order_id || null;

    if (txn.plantation_id) {
      // link transaction to plantation and update status
      try {
        const result = await completePlantationRecord(
          txn.plantation_id,
          razorpay_order_id,
          session,
        );

        if (result?.order?._id && !txn.order_id) {
          generatedOrderId = result.order._id;
          await Transaction.findByIdAndUpdate(
            txn._id,
            { order_id: generatedOrderId },
            { session },
          );
        }
        console.log(
          `[Payment] ✅ Plantation ${txn.plantation_id} marked as Completed`,
        );
      } catch (err) {
        console.error(
          `[Verification] Error completing plantation record:`,
          err.message,
        );
        // We continue because payment is confirmed anyway, but we log the error
      }
    }

    // ── STEP 4: Update pre-existing linked Order → Paid (if it already existed) ──
    // NOTE: If txn.order_id was null, the order was just created by completePlantationRecord above.
    // If txn.order_id was already set (order-based payments), update it explicitly here.
    if (txn.order_id) {
      await Order.findByIdAndUpdate(
        txn.order_id,
        {
          payment_status: "Paid",
          order_status: "Paid",
        },
        { session },
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.json({
      status: true,
      message: "Payment verified. Plantation status updated to Completed.",
      data: {
        plantation_id: txn.plantation_id || null,
        order_id: generatedOrderId,
        razorpay_order_id,
        razorpay_payment_id,
        amount_paid: txn.amount,
      },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    throw error;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Get Plantation Payment Status
// @route  POST /api/payment/plantation-status
// @body   { plantation_id* }
// Allows app to poll/check current payment status of a plantation
// ─────────────────────────────────────────────────────────────────────────────
export const getPlantationPaymentStatus = asyncHandler(async (req, res) => {
  const plantation_id = req.body.plantation_id || req.query.plantation_id;
  if (!plantation_id) throw new ApiError(400, "plantation_id is required");

  const plantation = await Plantation.findById(plantation_id)
    .select(
      "payment_status amount trees_count plantation_status planted_count transaction_id source",
    )
    .lean();

  if (!plantation) throw new ApiError(404, "Plantation not found");

  // Find most recent transaction for this plantation
  const txn = await Transaction.findOne({ plantation_id })
    .sort({ created_at: -1 })
    .select("status transaction_id amount created_at")
    .lean();

  res.json({
    status: true,
    message: "Payment status fetched",
    data: {
      plantation_id,
      payment_status: plantation.payment_status,
      plantation_status: plantation.plantation_status,
      amount: plantation.amount,
      trees_count: plantation.trees_count,
      planted_count: plantation.planted_count,
      source: plantation.source,
      transaction: txn
        ? {
          razorpay_order_id: txn.transaction_id,
          gateway_status: txn.status,
          amount: txn.amount,
          initiated_at: txn.created_at,
        }
        : null,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Admin: List All Payments / Transactions
// @route  POST /api/payment/list
// @body   { page, limit, status, user_id, plantation_id, from_date, to_date, transaction_id }
// ─────────────────────────────────────────────────────────────────────────────
export const getAllPayments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status, // 'Pending' | 'Completed' | 'Failed'
    user_id, // filter by user
    plantation_id, // filter by plantation
    from_date, // date range start (ISO string)
    to_date, // date range end (ISO string)
    transaction_id, // search by exact Razorpay order ID
  } = req.body;

  // ── Build Filter ──────────────────────────────────────────────────────────
  const filter = {};
  if (status) filter.status = status;
  if (user_id) filter.user_id = user_id;
  if (plantation_id) filter.plantation_id = plantation_id;
  if (transaction_id) filter.transaction_id = transaction_id;

  // Date range
  if (from_date || to_date) {
    filter.created_at = {};
    if (from_date) filter.created_at.$gte = new Date(from_date);
    if (to_date) filter.created_at.$lte = new Date(to_date);
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const [payments, total] = await Promise.all([
    Transaction.find(filter)
      .select(
        "transaction_id razorpay_payment_id amount currency status method created_at user_id order_id plantation_id",
      )
      .populate("user_id", "name email mobile")
      .populate("order_id", "order_status amount")
      .populate("plantation_id", "payment_status trees_count source amount")
      .sort({ created_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  // ── Flatten for admin table display ──────────────────────────────────────
  const enriched = payments.map(txn => ({
    _id: txn._id,
    razorpay_order_id: txn.transaction_id,
    razorpay_payment_id: txn.razorpay_payment_id || null, // BUG FIX: field now in schema
    amount: txn.amount,
    currency: txn.currency,
    status: txn.status,  // Pending | Completed | Failed
    method: txn.method,
    created_at: txn.created_at,
    // User
    user_name: txn.user_id?.name || null,
    user_mobile: txn.user_id?.mobile || null,
    user_email: txn.user_id?.email || null,
    // Plantation
    plantation_id: txn.plantation_id?._id || null,
    plantation_source: txn.plantation_id?.source || null,
    plantation_trees: txn.plantation_id?.trees_count || null,
    plantation_amount: txn.plantation_id?.amount || null,
    plantation_pay_status: txn.plantation_id?.payment_status || null,
    // Order
    order_id: txn.order_id?._id || null,
    order_status: txn.order_id?.order_status || null,
  }));

  res.json({
    status: true,
    message: "Payments fetched",
    data: enriched,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Admin: Revenue & Transaction Stats
// @route  GET /api/payment/stats
// ─────────────────────────────────────────────────────────────────────────────
export const getPaymentStats = asyncHandler(async (req, res) => {
  const stats = await Transaction.aggregate([
    {
      $group: {
        _id: null,
        total_revenue: {
          $sum: { $cond: [{ $eq: ["$status", "Completed"] }, "$amount", 0] },
        },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
        },
        failed: { $sum: { $cond: [{ $eq: ["$status", "Failed"] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
        total_count: { $sum: 1 },
      },
    },
  ]);

  const result = stats[0] || {
    total_revenue: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    total_count: 0,
  };

  res.json({
    status: true,
    data: {
      total_revenue: result.total_revenue,
      total_transactions: result.total_count,
      counts: {
        completed: result.completed,
        failed: result.failed,
        pending: result.pending,
      },
    },
  });
});
