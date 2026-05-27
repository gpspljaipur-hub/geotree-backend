import mongoose from 'mongoose';

const MatchDotBallSchema = new mongoose.Schema({
    match_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
    team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    dot_balls: { type: Number, default: 0 },
    initial_dot_balls: { type: Number, default: 0 },
    pending_trees: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
MatchDotBallSchema.index({ match_id: 1, team_id: 1 }, { unique: true });

const IPLCampaignSchema = new mongoose.Schema({
    name: String,
    year: Number,
    status: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const MatchDotBall = mongoose.models['MatchDotBall'] || mongoose.model('MatchDotBall', MatchDotBallSchema);
export const IPLCampaign = mongoose.models['IPLCampaign'] || mongoose.model('IPLCampaign', IPLCampaignSchema);

