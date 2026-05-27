import mongoose from "mongoose";

const CarbonSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  state_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "State"
  },
  transport_type: String,
  electricity_type: String,
  food_type: String,
  inputs: {
    type: Object,
    default: {}
  },
  period: {
    type: String, // 'Annual' or 'Monthly'
    default: 'Annual'
  },
  carbon_result: Number,
  total: Number,
  total_tonnes: Number,
  breakdown: {
    transport: Number,
    energy: Number,
    food: Number,
    waste: Number
  },
  breakdown_percent: {
    transport: Number,
    energy: Number,
    food: Number,
    waste: Number
  },
  species_recommendations: {
    type: Array,
    default: []
  }
}, { timestamps: true });

export default mongoose.models['Carbon'] || mongoose.model('Carbon', CarbonSchema);


