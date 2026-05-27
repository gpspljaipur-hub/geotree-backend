import mongoose from "mongoose";

const SupportSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  support_type: {
    type: String,
    enum: ['team', 'match'],
    required: true
  },
  team_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    required: false
  },
  match_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Match",
    required: false
  },
  trees: {
    type: Number,
    required: true,
    default: 0
  },
  amount: {
    type: Number,
    required: false,
    default: 0
  },
  plantation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Plantation",
    required: false
  },
  tournament_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tournament",
    required: false
  }
}, { timestamps: true });

// Indexes for performance
SupportSchema.index({ user_id: 1 });
SupportSchema.index({ match_id: 1 });
SupportSchema.index({ team_id: 1 });
SupportSchema.index({ support_type: 1 });

export default mongoose.models['Support'] || mongoose.model('Support', SupportSchema);

