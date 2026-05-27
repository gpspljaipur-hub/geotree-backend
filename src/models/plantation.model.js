import mongoose from "mongoose";

const PlantationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users", // Ensure this matches User model name (sometimes 'User' or 'users')
    required: true
  },
  occasion_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OccasionType",
    required: false
  },
  carbon_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Carbon",
    required: false
  },
  tournament_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tournament",
    required: false
  },
  source: {
    type: String,
    enum: ['Occasion', 'Carbon', 'Tournament', 'General'],
    default: 'General'
  },
  trees_count: {
    type: Number,
    required: true
  },
  // "Distribute n plants by species"
  plants: [{
    plant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Species"
    },
    plant_name: String, // Fallback/Snapshot
    quantity: {
      type: Number,
      default: 1
    },
    price: Number,
    tree_height: String
  }],
  // "Enter name" field
  name: {
    type: String
  },
  // "Date" field
  date: {
    type: Date,
    default: Date.now
  },
  // "Message (optional)" field
  message: {
    type: String,
    default: ""
  },
  site_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Site"
  },
  site_name: { // Fallback name or specific details
    type: String
  },
  lat: Number,
  lng: Number,
  // Payment Information
  amount: {
    type: Number,
    default: 0
  },
  payment_status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending'
  },
  transaction_id: {
    type: String
  },
  // Razorpay order ID saved at payment initiation — used for webhook cross-check
  razorpay_order_id: {
    type: String,
    index: true  // Indexed for fast lookup during webhook delivery
  },
  state_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "State"
  },
  state_name: {
    type: String
  },


  // Occasion Specific Details
  occasion_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Store IPL Support intent data here
  ipl_support: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // Flag to check if support logic has been executed
  is_support_executed: {
    type: Boolean,
    default: false
  },
  // Physical planting progress
  planted_count: {
    type: Number,
    default: 0
  },
  plantation_status: {
    type: String,
    enum: ['Pending', 'Partially Planted', 'Fully Planted'],
    default: 'Pending'
  }
}, { timestamps: true });

// ─── Indexes for Performance ──────────────────────────────────────────────────
// Compound indexes aligned to actual query patterns in plantation.controller.js

// User history: filter by user_id, sort by createdAt
PlantationSchema.index({ user_id: 1, createdAt: -1 });

// List by source + payment_status (most common admin filter combo)
PlantationSchema.index({ source: 1, payment_status: 1, createdAt: -1 });

// Occasion plantations: filter by source + occasion_id
PlantationSchema.index({ source: 1, occasion_id: 1 });

// Carbon plantations: filter by source + carbon_id
PlantationSchema.index({ source: 1, carbon_id: 1 });

// Tournament (IPL) plantations: filter by source + tournament_id + ipl_support.support_type
PlantationSchema.index({ source: 1, tournament_id: 1, 'ipl_support.support_type': 1 });

// Site-level queries (used in admin filters, deletion rollback)
PlantationSchema.index({ site_id: 1 });

// State-level admin filter
PlantationSchema.index({ state_id: 1 });

// Payment status standalone (used in completePlantationRecord)
PlantationSchema.index({ payment_status: 1 });

// Date sorting (fallback for sort=-date queries)
PlantationSchema.index({ date: -1 });

export default mongoose.models['Plantation'] || mongoose.model('Plantation', PlantationSchema);


