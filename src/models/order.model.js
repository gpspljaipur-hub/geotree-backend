import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
    type: { type: String, required: true }, // e.g., 'Individual', 'IPL', 'Corporate'
    plantation_site_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Plantation' },
    occasion_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OccasionType' },
    carbon_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Carbon' },
    tournament_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
    site_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    source: {
        type: String,
        enum: ['Occasion', 'Carbon', 'Tournament', 'General'],
        default: 'General'
    },
    trees_count: { type: Number, required: true },
    amount: { type: Number, required: true },
    order_status: {
        type: String,
        enum: ['Pending', 'Paid', 'Assigned', 'Executed', 'Verified', 'Completed', 'Cancelled'],
        default: 'Pending'
    },
    payment_status: { type: String, default: 'Pending' },
    assigned_field_team: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }, // Field team is an Admin user? Or 'users'?
    execution_date: Date,
    remarks: String,
    certificate_url: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Indexes for performance
OrderSchema.index({ user_id: 1 });
OrderSchema.index({ order_status: 1 });
OrderSchema.index({ type: 1 });
OrderSchema.index({ source: 1 });
OrderSchema.index({ carbon_id: 1 });
OrderSchema.index({ tournament_id: 1 });
OrderSchema.index({ payment_status: 1 });
OrderSchema.index({ created_at: -1 });
OrderSchema.index({ updated_at: -1 });

export default mongoose.models['Order'] || mongoose.model('Order', OrderSchema);

