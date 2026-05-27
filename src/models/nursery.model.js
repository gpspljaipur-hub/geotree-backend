import mongoose from "mongoose";

const NurserySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    nursery_image: {
        type: String,
        required: false
    },
    lat: {
        type: Number,
        required: true
    },
    lng: {
        type: Number,
        required: true
    },
    ownership_type: {
        type: String,
        enum: ['Government', 'Private', 'NGO', 'Community'],
        default: 'Government'
    },
    khasra_id: {
        type: String,
        required: false
    },
    address: {
        type: String,
        required: false
    },
    description: {
        type: String,
        required: false
    },
    stock: [{
        plant_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Species'
        },
        count: {
            type: Number,
            default: 0
        }
    }],
    status: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: true });

export default mongoose.models['Nursery'] || mongoose.model('Nursery', NurserySchema);
