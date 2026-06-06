import mongoose from "mongoose";

const MatchSchema = new mongoose.Schema({
  team1_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    required: true
  },
  team2_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    required: true
  },
  match_date: {
    type: Date,
    required: true,
    index: true
  },
  match_time: {
    type: String,
    required: false
  },
  venue: {
    type: String,
    required: false
  },
  match_status: {
    type: String,
    enum: ['upcoming', 'live', 'completed'],
    default: 'upcoming',
    index: true
  },
  status: {
    type: Boolean,
    default: true,
    index: true
  },
  team1_trees: {
    type: Number,
    default: 0
  },
  team2_trees: {
    type: Number,
    default: 0
  },
  team1_dotball: {
    type: Number,
    default: 0
  },
  team2_dotball: {
    type: Number,
    default: 0
  },
  team1_initial_dotball: {
    type: Number,
    default: 0
  },
  team2_initial_dotball: {
    type: Number,
    default: 0
  },
  match_dot_balls: {
    type: Number,
    default: 0
  },
  winner_team_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    required: false
  },
  completed_at: {
    type: Date
  },
  pending_settled: {
    type: Boolean,
    default: false
  },
  tournament_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: false,
    index: true
  }
}, { timestamps: true });

export default mongoose.models['Match'] || mongoose.model('Match', MatchSchema);

