// models/Tournament.js
import mongoose from "mongoose";

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },           // IPL 2026
    tournament_status: {
      type: String,
      enum: ["upcoming", "live", "completed"],
      default: "upcoming",
    },
    short_name: { type: String },                      // IPL
    description: { type: String },
    start_date: { type: Date, required: true },
    end_date: { type: Date },
    venue: { type: String },
    image: {
      type: String, // URL/Path to the tournament image
      default: null
    },
    status: {
      type: Boolean,
      default: true,
      index: true
    },
  },
  { timestamps: true }
);

export default mongoose.models['Tournament'] || mongoose.model('Tournament', tournamentSchema);

