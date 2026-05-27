import mongoose from 'mongoose';

const IPLConfigSchema = new mongoose.Schema({
    trees_per_dot_ball: { type: Number, default: 500 },
    support_partner: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const IPLConfig = mongoose.models['IPLConfig'] || mongoose.model('IPLConfig', IPLConfigSchema);

