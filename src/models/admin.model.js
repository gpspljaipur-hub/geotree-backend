import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    image: { type: String },
    password_hash: { type: String, required: true },
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'finance', 'field', 'verification', 'content'],
        default: 'admin',
        index: true
    },
    status: { type: Boolean, default: true, index: true },
    failed_login_attempts: { type: Number, default: 0 },
    last_login_at: { type: Date },
    locked_until: { type: Date },
    reset_password_token: { type: String },
    reset_password_expires: { type: Date }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.models['Admin'] || mongoose.model('Admin', AdminSchema);
