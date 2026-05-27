import mongoose from 'mongoose';

const VariationSchema = new mongoose.Schema({
    height: { type: String, trim: true },
    price: { type: Number, default: 0, min: 0 }
}, { _id: false });

const SpeciesSchema = new mongoose.Schema({
    state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'State', index: true, default: null },
    site_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', index: true, default: null }, // Link to Site
    name: { type: String, required: [true, 'Species name is required'], trim: true },
    scientific_name: { type: String, trim: true },
    description: { type: String, trim: true },
    species_image: { type: String },
    co2_absorption: { type: Number, default: 0, min: 0 }, // kg/year
    maturity_period: { type: String, trim: true },
    variations: { type: [VariationSchema], default: [] },
    status: { type: Boolean, default: true, index: true }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound index for fast filtering
SpeciesSchema.index({ state_id: 1, site_id: 1, status: 1 });
SpeciesSchema.index({ name: 1 }); // Index for searching

export default mongoose.models['Species'] || mongoose.model('Species', SpeciesSchema);
