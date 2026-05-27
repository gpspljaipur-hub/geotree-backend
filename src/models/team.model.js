import mongoose from "mongoose";

const TeamSchema = new mongoose.Schema({
  team_name: {
    type: String,
    required: true,
    unique: true
  },
  team_status: {
    type: String,
    enum: ['upcoming', 'live', 'completed'],
    default: 'upcoming'
  },
  team_logo: {
    type: String,
    required: false
  },
  team_short_name: {
    type: String,
    required: false
  },
  description: {
    type: String,
    required: false
  },
  team_color: {
    type: String,
    required: false
  },
  total_trees: {
    type: Number,
    default: 0
  },
  total_supporters: {
    type: Number,
    default: 0
  },
  total_dot_balls: {
    type: Number,
    default: 0
  },
  support_trees: {
    type: Number,
    default: 0
  },
  tournament_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: false
  },
  status: {
    type: Boolean,
    default: true,
    index: true
  }
}, { timestamps: true });

export default mongoose.models['Team'] || mongoose.model('Team', TeamSchema);
