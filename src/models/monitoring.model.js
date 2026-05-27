
import mongoose from "mongoose";

const MonitoringSchema = new mongoose.Schema({
    site_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Site',
        required: true
    },
    monitoring_date: {
        type: Date,
        default: Date.now
    },
    type: {
        type: String,
        enum: ['Drone', 'Field', 'AI'],
        required: true
    },
    media: [{
        type: String // URL to image/video
    }],
    ai_stats: {
        health_score: Number, // 0-100
        growth_rate: Number, // %
        canopy_cover: Number, // %
        survival_rate: Number // %
    },
    notes: String
}, { timestamps: true });

export default mongoose.models['Monitoring'] || mongoose.model('Monitoring', MonitoringSchema);
