import mongoose from "mongoose";
import { getCentroid, getArea } from "../utils/geo.util.js";

const SiteSchema = new mongoose.Schema({
    site_name: {
        type: String,
        required: true,
        index: true
    },
    lat: {
        type: Number
    },
    lng: {
        type: Number
    },
    boundary: {
        type: {
            type: String,
            enum: ['Polygon']
        },
        coordinates: {
            type: [[[Number]]], // Array of arrays of arrays of numbers
        }
    },
    state_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "State",
        required: true,
        index: true
    },
    district: {
        type: String,
        required: true,
        index: true
    },
    block: {
        type: String
    },
    gram_panchayat: {
        type: String
    },
    village: {
        type: String
    },
    plantation_type: {
        type: String
    },
    status: {
        type: Boolean,
        default: true,
        index: true
    },
    capacity: {
        type: Number,
        default: -1 // -1 means unlimited, otherwise strictly limits the number of trees
    },
    planted_count: {
        type: Number,
        default: 0
    },
    native_species: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Species"
    }],
    area: {
        type: Number // in hectares (ha)
    },
    site_image: {
        type: String
    },
    description: {
        type: String
    }
}, { timestamps: true });

// Robustness: Auto-calculate centroid before saving if missing
SiteSchema.pre("save", function (next) {
    if (this.boundary && this.boundary.coordinates) {
        // Auto-calculate centroid if missing
        if (!this.lat || !this.lng) {
            const centroid = getCentroid(this.boundary);
            if (centroid) {
                this.lat = centroid.lat;
                this.lng = centroid.lng;
            }
        }
        // Auto-calculate area in hectares (1 ha = 10,000 sq meters)
        this.area = getArea(this.boundary) / 10000;
    }
    next();
});

SiteSchema.virtual('remaining_trees').get(function () {
    if (this.capacity === undefined || this.capacity === -1) return "Unlimited";
    return Math.max(0, this.capacity - (this.planted_count || 0));
});

SiteSchema.set('toJSON', { virtuals: true });
SiteSchema.set('toObject', { virtuals: true });

SiteSchema.index({ boundary: '2dsphere' });
SiteSchema.index({ state_id: 1, status: 1 });

// --- State Activation Logic ---
// Sync State status after Site is saved or removed
// We use a pre-save/pre-update hook to capture the old state_id if it changes
SiteSchema.pre("save", async function (next) {
    if (this.isModified("state_id") || this.isModified("status")) {
        this._oldStateId = this._originalStateId; // Capture if we added it in a pre-query, but for new docs it's null
    }
    next();
});

SiteSchema.post("save", async function (doc) {
    const { syncStateStatus } = await import("../utils/stateSync.util.js");
    await syncStateStatus(doc.state_id);
    if (this._oldStateId && this._oldStateId.toString() !== doc.state_id.toString()) {
        await syncStateStatus(this._oldStateId);
    }
});

SiteSchema.post("findOneAndDelete", async function (doc) {
    if (doc) {
        const { syncStateStatus } = await import("../utils/stateSync.util.js");
        await syncStateStatus(doc.state_id);
    }
});

// For findOneAndUpdate, we need to handle the possibility of state change
SiteSchema.pre("findOneAndUpdate", async function (next) {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
        this._oldStateId = docToUpdate.state_id;
    }
    next();
});

SiteSchema.post("findOneAndUpdate", async function (doc) {
    if (doc) {
        const { syncStateStatus } = await import("../utils/stateSync.util.js");
        await syncStateStatus(doc.state_id);
        if (this._oldStateId && this._oldStateId.toString() !== doc.state_id.toString()) {
            await syncStateStatus(this._oldStateId);
        }
    }
});

export default mongoose.models['Site'] || mongoose.model('Site', SiteSchema);
