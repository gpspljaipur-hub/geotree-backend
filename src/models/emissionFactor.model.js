import mongoose from 'mongoose';

const EmissionFactorSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        enum: ['transport', 'energy', 'food', 'waste', 'other']
    },
    sub_category: {
        type: String,
        required: true
    },
    value: {
        type: String, // Simplified name, e.g. "car" for "Car (Diesel)"
        default: ''
    },
    factor: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        required: true // e.g., 'kgCO2e/km', 'kgCO2e/kWh'
    },
    region: {
        type: String,
        default: 'Global'
    },
    source: String,
    year: Number,
    image: {
        type: String,
        default: null
    },
    status: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Prevent generic "mongoose.models" errors during hot-reload/testing
export default mongoose.models['EmissionFactor'] || mongoose.model('EmissionFactor', EmissionFactorSchema);
