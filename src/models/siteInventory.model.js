import mongoose from "mongoose";

const SiteInventorySchema = new mongoose.Schema({
    site_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Site",
        required: true,
        index: true
    },
    species_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Species",
        required: true,
        index: true
    },
    tree_height: {
        type: String,
        required: true
    },
    ordered_count: {
        type: Number,
        default: 0
    },
    planted_count: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Ensure unique combination of site, species, and height
SiteInventorySchema.index({ site_id: 1, species_id: 1, tree_height: 1 }, { unique: true });

// Virtual for remaining count
SiteInventorySchema.virtual('remaining_count').get(function () {
    return Math.max(0, this.ordered_count - this.planted_count);
});

SiteInventorySchema.set('toJSON', { virtuals: true });
SiteInventorySchema.set('toObject', { virtuals: true });

export default mongoose.models['SiteInventory'] || mongoose.model('SiteInventory', SiteInventorySchema);
