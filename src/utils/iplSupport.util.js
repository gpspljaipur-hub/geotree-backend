import Team from '../models/team.model.js';
import Match from '../models/match.model.js';
import { MatchDotBall } from '../models/ipl.model.js';
import Support from '../models/support.model.js';
import mongoose from 'mongoose';

/**
 * Syncs legacy dot ball fields on the Match model from MatchDotBall records.
 */
export const syncMatchLegacyFields = async (matchId) => {
    const match = await Match.findById(matchId);
    if (!match) return;

    const dotBalls = await MatchDotBall.find({ match_id: matchId }).lean();
    let d1 = 0, d2 = 0, i1 = 0, i2 = 0;

    dotBalls.forEach(db => {
        const teamIdStr = db.team_id.toString();
        if (match.team1_id && teamIdStr === (match.team1_id._id || match.team1_id).toString()) {
            d1 = db.dot_balls || 0;
            i1 = db.initial_dot_balls || 0;
        }
        if (match.team2_id && teamIdStr === (match.team2_id._id || match.team2_id).toString()) {
            d2 = db.dot_balls || 0;
            i2 = db.initial_dot_balls || 0;
        }
    });

    await Match.findByIdAndUpdate(matchId, {
        team1_dotball: d1,
        team2_dotball: d2,
        team1_initial_dotball: i1,
        team2_initial_dotball: i2,
        match_dot_balls: d1 + d2
    });
};

/**
 * Executes the IPL support logic for a given plantation.
 * Deducts from team/match inventories and creates a Support record.
 */
export const executeSupportInternal = async (plantation) => {
    if (plantation.is_support_executed) {
        return { status: true, message: "Support already executed", data: plantation };
    }

    const iplSupport = plantation.ipl_support;
    if (!iplSupport) throw new Error("No IPL support data found");

    const reduction = plantation.trees_count;
    const amount = plantation.amount || 0;
    const supportType = iplSupport.support_type;

    if (supportType === 'team') {
        const team = await Team.findById(iplSupport.team_id);
        if (!team) throw new Error("Team not found");

        let remaining = reduction;

        // 1. Take from Team-level inventory (Grand Challenge)
        const fromGrand = Math.min(team.total_dot_balls || 0, remaining);
        if (fromGrand > 0) {
            await Team.findByIdAndUpdate(team._id, { $inc: { total_dot_balls: -fromGrand } });
            remaining -= fromGrand;
        }

        // 2. Take from Match-level inventories (Oldest matches first)
        if (remaining > 0) {
            const tournamentId = iplSupport.tournament_id || plantation.tournament_id;
            const matches = await Match.find({ tournament_id: tournamentId }).select('_id team1_id team2_id').lean();
            const matchIds = matches.map(m => m._id);

            const matchBalls = await MatchDotBall.find({
                team_id: team._id,
                match_id: { $in: matchIds },
                dot_balls: { $gt: 0 }
            }).sort({ created_at: 1 });

            for (const mb of matchBalls) {
                if (remaining <= 0) break;
                const deduct = Math.min(mb.dot_balls, remaining);
                await MatchDotBall.findByIdAndUpdate(mb._id, { $inc: { dot_balls: -deduct } });

                const matchRec = matches.find(m => m._id.toString() === mb.match_id.toString());
                if (matchRec) {
                    const field = (matchRec.team1_id?.toString() === team._id.toString()) ? 'team1_trees' : 'team2_trees';
                    await Match.findByIdAndUpdate(mb.match_id, { $inc: { [field]: deduct } });
                }

                await syncMatchLegacyFields(mb.match_id);
                remaining -= deduct;
            }
        }

        // Update Impact Stats
        await Team.findByIdAndUpdate(iplSupport.team_id, {
            $inc: { total_trees: reduction, total_supporters: 1, total_amount: amount }
        });

    } else if (supportType === 'match') {
        const currentMB = await MatchDotBall.findOne({ match_id: iplSupport.match_id, team_id: iplSupport.team_id });
        const deduct = Math.min(reduction, currentMB?.dot_balls || 0);

        if (deduct > 0) {
            await MatchDotBall.findByIdAndUpdate(currentMB._id, { $inc: { dot_balls: -deduct } });
        }

        const matchRec = await Match.findById(iplSupport.match_id).select('team1_id team2_id').lean();
        if (matchRec) {
            const field = (matchRec.team1_id?.toString() === iplSupport.team_id.toString()) ? 'team1_trees' : 'team2_trees';
            await Match.findByIdAndUpdate(iplSupport.match_id, { $inc: { [field]: deduct || reduction } });
        }

        await Team.findByIdAndUpdate(iplSupport.team_id, {
            $inc: { total_trees: reduction, total_supporters: 1, total_amount: amount }
        });
        await syncMatchLegacyFields(iplSupport.match_id);
    }

    await Support.create({
        user_id: plantation.user_id,
        support_type: supportType,
        team_id: iplSupport.team_id,
        match_id: iplSupport.match_id || undefined,
        trees: reduction,
        amount: amount,
        plantation_id: plantation._id,
        tournament_id: iplSupport.tournament_id
    });

    plantation.is_support_executed = true;
    await plantation.save();

    return { status: true, message: "Support executed", data: { plantation_id: plantation._id } };
};
