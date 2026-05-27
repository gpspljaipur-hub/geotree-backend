import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    plantation_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plantation',
        default: null
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    // Razorpay's order_id (stored as transaction_id for legacy compat)
    transaction_id: {
        type: String,
        index: true   // Indexed — looked up by every payment confirmation
    },
    // BUG FIX: razorpay_payment_id was missing from schema.
    // verifypayment() was trying to save it but Mongoose strict mode silently dropped it.
    // Now stored so admin can cross-check with Razorpay Dashboard.
    razorpay_payment_id: {
        type: String,
        default: null
    },
    amount: {
        type: Number,
        required: true,
        default: 0
    },
    currency: {
        type: String,
        default: 'INR'
    },
    method: {
        type: String,
        default: 'Razorpay'
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Pending',
        index: true   // Indexed — admin payment list filters by status frequently
    },
    // Full Razorpay webhook/confirm payload (kept for audit + dispute resolution)
    gateway_response: {
        type: Object,
        default: null
    }
}, {
    // BUG FIX: Custom timestamp aliases so sort({ created_at: -1 }) works correctly.
    // Previously 'created_at' was an alias but getAllPayments was sorting on it —
    // needed both the alias AND the actual Mongoose field to be consistent.
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// ─── Indexes for Performance ──────────────────────────────────────────────────

// Admin list: filter by user_id, sort by created_at
TransactionSchema.index({ user_id: 1, created_at: -1 });

// Admin list: filter by plantation_id (for per-plantation payment history)
TransactionSchema.index({ plantation_id: 1, created_at: -1 });

// Admin list: filter by status + time (most common filter combo)
TransactionSchema.index({ status: 1, created_at: -1 });

// ─────────────────────────────────────────────────────────────────────────────

export default mongoose.models['Transaction'] || mongoose.model('Transaction', TransactionSchema);
