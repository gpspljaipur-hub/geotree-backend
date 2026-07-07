import mongoose from "mongoose";

const StateSchema = new mongoose.Schema({
  state_name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  state_image: {
    type: String,
    required: false
  },
  districts: [{
    name: { type: String, required: true },
    blocks: [{ type: String }]
  }],
  status: {
    type: Boolean,
    default: true,
    index: true
  },
  tree_count: {
    type: String,
    default: "0"
  },
  project_count: {
    type: Number,
    default: 0
  },
  native_species: [{
    type: String
  }],
  is_popular: {
    type: Boolean,
    default: false
  },
  badge: {
    type: String
  }
}, { timestamps: true });

export default mongoose.models['State'] || mongoose.model('State', StateSchema);


