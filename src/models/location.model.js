import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema({
  location_name: {
    type: String,
    required: true
  },
  lat: {
    type: Number
  },
  lng: {
    type: Number
  },
  state_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "State",
    required: false,
    index: true
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
  }
}, { timestamps: true });

LocationSchema.index({ state_id: 1, status: 1 });

export default mongoose.models['Location'] || mongoose.model('Location', LocationSchema);


