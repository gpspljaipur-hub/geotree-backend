import mongoose from "mongoose";

const LocationDataSchema = new mongoose.Schema({
    // Foreign key → State (authoritative link; no back-reference on State to avoid loops)
    state_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "State",
        index: true
    },
    // Plain-string mirror kept for legacy string-based queries / readability
    state: { type: String, required: true, index: true },
    district: { type: String, required: true, index: true },
    block: { type: String, index: true, sparse: true },
    gram_panchayat: { type: String, index: true, sparse: true },
    village: { type: String, index: true, sparse: true }
}, { timestamps: true });

// Compound index for efficient cascaded dropdown queries
LocationDataSchema.index({ state_id: 1, district: 1 });
LocationDataSchema.index({ state: 1, district: 1, block: 1, gram_panchayat: 1, village: 1 });

export default mongoose.models['LocationData'] || mongoose.model('LocationData', LocationDataSchema);
