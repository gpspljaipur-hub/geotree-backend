import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
    admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    action: String,
    module: String,
    target_id: String,
    details: String,
    ip_address: String,
    metadata: Object
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.models['AuditLog'] || mongoose.model('AuditLog', AuditLogSchema);

