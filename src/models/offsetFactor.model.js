import mongoose from 'mongoose';

const OffsetFactorSchema = new mongoose.Schema({
    tree_species_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Species'
    },
    species_name: String, // Denormalized for easier lookup
    sequestration_per_year: {
        type: Number, // kg CO2 per year
        required: true
    },
    maturity_age: Number, // Years until full sequestration potential
    region: String,
    description: String,
    status: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.models['OffsetFactor'] || mongoose.model('OffsetFactor', OffsetFactorSchema);
