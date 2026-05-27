import mongoose from 'mongoose';

const LoginLogSchema = new mongoose.Schema({
    admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    ip_address: String,
    role: String,
    status: { type: String, enum: ['Success', 'Failed'] },
    login_time: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.models['LoginLog'] || mongoose.model('LoginLog', LoginLogSchema);

