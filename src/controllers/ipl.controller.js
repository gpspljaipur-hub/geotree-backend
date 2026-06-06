import Team from '../models/team.model.js';
import Match from '../models/match.model.js';
import { MatchDotBall, IPLCampaign } from '../models/ipl.model.js';
import { IPLConfig } from '../models/iplConfig.model.js';
import Tournament from '../models/tournament.model.js';
import Support from '../models/support.model.js';
import Plantation from '../models/plantation.model.js';
import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { translateData } from "../utils/translation.util.js";
import { getRequestParams, parseBoolean } from "../utils/request.util.js";
import { deleteFile } from "../utils/file.util.js";
import path from "path";

import { executeSupportInternal, syncMatchLegacyFields } from "../utils/iplSupport.util.js";

const parseMatchDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string") {
        const trimmed = value.trim();
        const slashMatch = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
        if (slashMatch) {
            const [, year, month, day] = slashMatch;
            return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
        }
    }
    return new Date(value);
};



export const getCampaigns = asyncHandler(async (req, res) => {
    const campaigns = await IPLCampaign.find({}).sort({ created_at: -1 }).lean();
    res.json({ status: true, data: campaigns });
});

export const addCampaign = asyncHandler(async (req, res) => {
    const { name, trees_multiplier, start_date, end_date, status, active } = req.body;
    // Handle both 'active' (legacy) and 'status' (model)
    const finalStatus = status !== undefined ? parseBoolean(status) : (active !== undefined ? parseBoolean(active) : true);
    const campaign = await IPLCampaign.create({ name, trees_multiplier, start_date, end_date, status: finalStatus });
    res.status(201).json({ status: true, message: "Campaign added", data: campaign });
});

export const updateCampaign = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) throw new ApiError(400, "Campaign ID required");
    const campaign = await IPLCampaign.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ status: true, message: "Campaign updated", data: campaign });
});

export const deleteCampaign = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) throw new ApiError(400, "Campaign ID required");
    await IPLCampaign.findByIdAndDelete(id);
    res.json({ status: true, message: "Campaign deleted" });
});

// --- Config ---

export const getConfig = asyncHandler(async (req, res) => {
    let config = await IPLConfig.findOne({});
    if (!config) config = await IPLConfig.create({});
    res.json({ status: true, data: config });
});

export const updateConfig = asyncHandler(async (req, res) => {
    const config = await IPLConfig.findOneAndUpdate({}, req.body, { new: true, upsert: true });
    res.json({ status: true, message: "Config updated", data: config });
});

// --- Teams ---

export const getTeamList = asyncHandler(async (req, res) => {
    const { tournament_id, lang = 'en', status, page = 1, limit = 20, sort = 'team_name' } = getRequestParams(req, ['tournament_id', 'lang', 'status', 'page', 'limit', 'sort']);
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

    const baseFilter = {};
    if (status !== undefined) baseFilter.status = parseBoolean(status);
    else if (!isAdmin) baseFilter.status = { $ne: false };

    const skip = (Number(page) - 1) * Number(limit);
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;

    if (tournament_id) {
        const [teams, total] = await Promise.all([
            Team.find({ ...baseFilter, tournament_id }).sort({ [sortField]: sortOrder }).skip(skip).limit(Number(limit)).lean(),
            Team.countDocuments({ ...baseFilter, tournament_id })
        ]);

        let finalTeams = teams;
        if (lang !== 'en') finalTeams = await translateData(finalTeams, ['team_name', 'team_short_name', 'description'], lang);

        return res.json({
            status: true,
            data: finalTeams,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
        });
    }

    if (!isAdmin) {
        const tournaments = await Tournament.find({ status: { $ne: false } }).sort({ start_date: -1 }).lean();
        const grouped = [];
        for (const t of tournaments) {
            let teams = await Team.find({ ...baseFilter, tournament_id: t._id }).sort({ team_name: 1 }).limit(Number(limit)).lean();
            if (teams.length > 0) {
                if (lang !== 'en') teams = await translateData(teams, ['team_name', 'team_short_name', 'description'], lang);
                grouped.push({ tournament: t, teams: teams });
            }
        }
        return res.json({ status: true, grouped: true, data: grouped });
    }

    // Default for Admin: List all teams across all tournaments
    const [teams, total] = await Promise.all([
        Team.find(baseFilter)
            .populate('tournament_id', 'name short_name')
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
        Team.countDocuments(baseFilter)
    ]);

    let finalTeams = teams;
    if (lang !== 'en') finalTeams = await translateData(finalTeams, ['team_name', 'team_short_name', 'description'], lang);

    res.json({
        status: true,
        data: finalTeams,
        pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
    });
});

export const addTeam = asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (!data.team_name && data.name) data.team_name = data.name;
    if (!data.team_name) throw new ApiError(400, "Team name is required");

    if (data.status !== undefined) data.status = parseBoolean(data.status);

    if (req.file) data.team_logo = `/uploads/team/${req.file.filename}`;
    const newTeam = await Team.create(data);
    const teamObj = newTeam.toObject();

    res.status(201).json({ status: true, message: "Team added", data: teamObj });
});

export const updateTeam = asyncHandler(async (req, res) => {
    const id = req.body.id || req.body.team_id || req.params.id;
    if (!id) throw new ApiError(400, "ID required");

    const data = { ...req.body };
    if (req.file) data.team_logo = `/uploads/team/${req.file.filename}`;

    const updated = await Team.findByIdAndUpdate(id, data, { new: true }).lean();
    if (!updated) throw new ApiError(404, "Team not found");

    res.json({ status: true, message: "Team updated", data: updated });
});

export const deleteTeam = asyncHandler(async (req, res) => {
    const id = req.body.id || req.body.team_id || req.query.id;
    if (!id) throw new ApiError(400, "ID required");
    const team = await Team.findById(id);
    if (!team) throw new ApiError(404, "Team not found");

    if (team.team_logo) deleteFile(team.team_logo);
    await Team.findByIdAndDelete(id);
    res.json({ status: true, message: "Team deleted" });
});

export const getTeamDetails = asyncHandler(async (req, res) => {
    const { team_id } = getRequestParams(req, ['team_id']);
    if (!team_id) throw new ApiError(400, "team_id required");

    const team = await Team.findById(team_id).lean();
    if (!team) throw new ApiError(404, "Team not found");

    const supports = await Support.countDocuments({ team_id, support_type: 'team' });
    res.json({ status: true, data: { ...team, total_supports: supports } });
});

export const teamPreplantSupport = asyncHandler(async (req, res) => {
    let { team_id, user_id, tree, amount, plantation_id } = req.body;
    if (req.user?.id) user_id = req.user.id;

    if (plantation_id) {
        const plantation = await Plantation.findById(plantation_id);
        if (!plantation) throw new ApiError(404, "Plantation not found");
        const result = await executeSupportInternal(plantation);
        return res.json(result);
    }

    if (!team_id || !user_id) throw new ApiError(400, "team_id and user_id are required");

    const team = await Team.findById(team_id).populate('tournament_id', 'name').lean();
    if (!team) throw new ApiError(404, "Team not found");

    // Dot ball inventory logic removed as per requirements.
    // Users can support as much as they want.

    res.json({
        status: true,
        redirect_to_plantation: true,
        plantation_data: {
            user_id,
            trees_count: Number(tree) || 0,
            amount: amount || (Number(tree) ? Number(tree) * 100 : 0),
            ipl_support: {
                support_type: 'team',
                team_id: team._id,
                team_name: team.team_name,
                team_logo: team.team_logo,
                tournament_id: team.tournament_id?._id,
                tournament_name: team.tournament_id?.name
            },
            suggested_occasion: 'IPL Team Support',
            suggested_message: `I'm supporting ${team.team_name}! Donate to plant more trees.`
        }
    });
});

export const teamChallenge = asyncHandler(async (req, res) => {
    const { tournament_id } = getRequestParams(req, ['tournament_id']);
    const filter = tournament_id ? { tournament_id } : {};

    const teams = await Team.find(filter).sort({ total_trees: -1 }).lean();
    const [totalMatches, totalSupports, totalTreesAgg] = await Promise.all([
        Match.countDocuments(),
        Support.countDocuments(),
        Support.aggregate([{ $group: { _id: null, total: { $sum: "$trees" } } }])
    ]);

    res.json({
        status: true,
        data: {
            teams: teams,
            tournament_stats: {
                total_matches: totalMatches,
                total_supports: totalSupports,
                total_trees: totalTreesAgg[0]?.total || 0
            }
        }
    });
});

/**
 * Tournament Leaderboard
 * Shows all teams in a tournament, their remaining dot balls (inventory),
 * and ranks them by trees supported.
 */
export const getTournamentLeaderboard = asyncHandler(async (req, res) => {
    const { tournament_id, lang = 'en' } = getRequestParams(req, ['tournament_id', 'lang']);
    if (!tournament_id) throw new ApiError(400, "tournament_id is required");

    const tournament = await Tournament.findById(tournament_id).lean();
    if (!tournament) throw new ApiError(404, "Tournament not found");

    // All matches in this tournament
    const matches = await Match.find({ tournament_id }).lean();
    const matchIds = matches.map(m => m._id);

    let teams = await Team.find({ tournament_id }).lean();
    if (lang !== 'en') teams = await translateData(teams, ['team_name', 'team_short_name'], lang);

    const leaderboard = await Promise.all(teams.map(async (team) => {
        const teamIdStr = team._id.toString();

        // 1. Inventory: Match-level pooled dot balls
        const matchBalls = await MatchDotBall.find({
            match_id: { $in: matchIds },
            team_id: team._id
        }).lean();
        const remainingMatchDotBalls = matchBalls.reduce((sum, b) => sum + (b.dot_balls || 0), 0);

        // 2. Performance: Matches played & won
        const teamMatches = matches.filter(m =>
            m.team1_id?.toString() === teamIdStr ||
            m.team2_id?.toString() === teamIdStr
        );
        const wins = matches.filter(m => m.winner_team_id?.toString() === teamIdStr).length;

        // 3. Impact: Trees & Supporters
        const supportStats = await Support.aggregate([
            { $match: { team_id: team._id, tournament_id: new mongoose.Types.ObjectId(tournament_id) } },
            { $group: { _id: null, total_trees: { $sum: "$trees" }, total_supporters: { $sum: 1 } } }
        ]);

        return {
            team_id: team._id,
            team_name: team.team_name,
            team_logo: team.team_logo,
            available_dot_balls: remainingMatchDotBalls + (team.total_dot_balls || 0),
            match_dot_balls: remainingMatchDotBalls,
            grand_dot_balls: team.total_dot_balls || 0,
            stats: {
                matches_played: teamMatches.length,
                matches_won: wins,
                impact_trees: supportStats[0]?.total_trees || 0,
                total_supporters: supportStats[0]?.total_supporters || 0
            }
        };
    }));

    // Rank by Trees Planted (Impact)
    leaderboard.sort((a, b) => b.stats.impact_trees - a.stats.impact_trees);

    // Add explicit rank
    const rankedLeaderboard = leaderboard.map((item, index) => ({
        rank: index + 1,
        ...item
    }));

    res.json({
        status: true,
        message: "Tournament leaderboard fetched",
        data: {
            tournament: tournament.name,
            teams: rankedLeaderboard
        }
    });
});

// --- Matches ---

export const getMatchList = asyncHandler(async (req, res) => {
    const { tournament_id, lang = 'en', page = 1, limit = 20, sort = 'match_date' } = getRequestParams(req, ['tournament_id', 'lang', 'page', 'limit', 'sort']);
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

    const fetchMatches = async (filter, skipTranslation = false) => {
        const today = new Date();
        const { status } = getRequestParams(req, ['status']);
        if (status !== undefined) filter.status = parseBoolean(status);
        else if (!isAdmin) filter.status = { $ne: false };

        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const skip = (Number(page) - 1) * Number(limit);

        const todayQuery = { ...filter, $or: [{ match_status: { $in: ['live', 'ongoing'] } }, { match_status: 'upcoming', match_date: { $gte: today, $lt: tomorrow } }] };
        const upcomingQuery = { ...filter, match_status: 'upcoming', match_date: { $gte: tomorrow } };
        const previousQuery = { ...filter, match_status: { $in: ['completed', 'previous'] } };

        let [todayMatches, upcomingMatches, previousMatches] = await Promise.all([
            Match.find(todayQuery).populate('team1_id team2_id winner_team_id', 'team_name team_logo team_short_name team_color').sort({ match_date: 1 }).lean(),
            Match.find(upcomingQuery).populate('team1_id team2_id winner_team_id', 'team_name team_logo team_short_name team_color').sort({ match_date: 1 }).skip(skip).limit(Number(limit)).lean(),
            Match.find(previousQuery).populate('team1_id team2_id winner_team_id', 'team_name team_logo team_short_name team_color').sort({ match_date: -1 }).skip(skip).limit(Number(limit)).lean()
        ]);

        if (lang !== 'en' && !skipTranslation) {
            const translated = await translateData([...todayMatches, ...upcomingMatches, ...previousMatches], ['venue'], lang);
            todayMatches = translated.slice(0, todayMatches.length);
            upcomingMatches = translated.slice(todayMatches.length, todayMatches.length + upcomingMatches.length);
            previousMatches = translated.slice(todayMatches.length + upcomingMatches.length);
        }

        return { today: todayMatches, upcoming: upcomingMatches, previous: previousMatches };
    };

    if (tournament_id) {
        const [data, total] = await Promise.all([
            fetchMatches({ tournament_id }),
            Match.countDocuments({ tournament_id })
        ]);
        return res.json({
            status: true,
            data,
            pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
        });
    }

    if (!isAdmin) {
        const tournaments = await Tournament.find({ status: { $ne: false } }).sort({ start_date: -1 }).lean();
        const tournamentIds = tournaments.map(t => t._id);

        const today = new Date();
        const { status } = getRequestParams(req, ['status']);
        const matchFilter = { tournament_id: { $in: tournamentIds } };
        if (status !== undefined) matchFilter.status = parseBoolean(status);
        else matchFilter.status = { $ne: false };

        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Fetch all matches for all active tournaments in a SINGLE query to avoid round-trips
        const allMatches = await Match.find(matchFilter)
            .populate('team1_id team2_id winner_team_id', 'team_name team_logo team_short_name team_color')
            .lean();

        // Perform translation in bulk to avoid multiple cached translation calls
        let translatedMatches = allMatches;
        if (lang !== 'en' && allMatches.length > 0) {
            translatedMatches = await translateData(allMatches, ['venue'], lang);
        }

        const skip = (Number(page) - 1) * Number(limit);
        const limitNum = Number(limit);

        const grouped = [];
        for (const t of tournaments) {
            const tIdStr = t._id.toString();
            const tMatches = translatedMatches.filter(m => m.tournament_id && m.tournament_id.toString() === tIdStr);

            // Today matches (ongoing or upcoming on today's date)
            const todayMatches = tMatches.filter(m => 
                ['live', 'ongoing'].includes(m.match_status) || 
                (m.match_status === 'upcoming' && m.match_date >= today && m.match_date < tomorrow)
            );
            todayMatches.sort((a, b) => new Date(a.match_date) - new Date(b.match_date));

            // Upcoming matches (upcoming on tomorrow's date or later)
            const upcomingMatches = tMatches.filter(m => 
                m.match_status === 'upcoming' && m.match_date >= tomorrow
            );
            upcomingMatches.sort((a, b) => new Date(a.match_date) - new Date(b.match_date));
            const paginatedUpcoming = upcomingMatches.slice(skip, skip + limitNum);

            // Previous matches (completed or previous)
            const previousMatches = tMatches.filter(m => 
                ['completed', 'previous'].includes(m.match_status)
            );
            previousMatches.sort((a, b) => new Date(b.match_date) - new Date(a.match_date));
            const paginatedPrevious = previousMatches.slice(skip, skip + limitNum);

            if (todayMatches.length || paginatedUpcoming.length || paginatedPrevious.length) {
                grouped.push({
                    tournament: t,
                    matches: {
                        today: todayMatches,
                        upcoming: paginatedUpcoming,
                        previous: paginatedPrevious
                    }
                });
            }
        }

        return res.json({ status: true, grouped: true, data: grouped });
    }

    // Default for Admin: List all matches across all tournaments
    const skip = (Number(page) - 1) * Number(limit);
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;

    const [matches, total] = await Promise.all([
        Match.find({})
            .populate('team1_id team2_id winner_team_id', 'team_name team_logo team_short_name team_color')
            .populate('tournament_id', 'name short_name')
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
        Match.countDocuments({})
    ]);

    let finalData = matches;
    if (lang !== 'en') finalData = await translateData(finalData, ['venue'], lang);

    res.json({
        status: true,
        data: finalData,
        pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
    });
});

export const addMatch = asyncHandler(async (req, res) => {
    const { team1_id, team2_id, match_date, team1_dotball, team2_dotball, tournament_id, status, match_status } = req.body;
    if (!team1_id || !team2_id || !match_date) throw new ApiError(400, "Teams and Date required");

    const t1 = Math.max(0, Number(team1_dotball) || 0);
    const t2 = Math.max(0, Number(team2_dotball) || 0);

    const match = await Match.create({
        ...req.body,
        match_date: parseMatchDate(match_date),
        team1_dotball: t1,
        team2_dotball: t2,
        team1_initial_dotball: t1,
        team2_initial_dotball: t2,
        match_dot_balls: t1 + t2,
        match_status: match_status || "upcoming",
        status: status !== undefined ? parseBoolean(status) : true
    });

    await MatchDotBall.create([
        { match_id: match._id, team_id: team1_id, dot_balls: t1, initial_dot_balls: t1 },
        { match_id: match._id, team_id: team2_id, dot_balls: t2, initial_dot_balls: t2 }
    ]);

    res.status(201).json({ status: true, message: "Match added", data: match });
});

export const updateMatch = asyncHandler(async (req, res) => {
    const id = req.body.id || req.body.match_id || req.params.id;
    if (!id) throw new ApiError(400, "Match ID required");

    const data = { ...req.body };
    if (data.match_date) data.match_date = parseMatchDate(data.match_date);
    if (data.status !== undefined) data.status = parseBoolean(data.status);

    // Filter out restricted fields if necessary, but for now assuming admin trust
    const match = await Match.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
    if (!match) throw new ApiError(404, "Match not found");

    if (data.match_status === 'completed') {
        await Match.findByIdAndUpdate(id, { completed_at: new Date() });
    }

    if (data.team1_dotball !== undefined || data.team2_dotball !== undefined || data.team1_initial_dotball !== undefined || data.team2_initial_dotball !== undefined) {
        if (data.team1_dotball !== undefined) await MatchDotBall.findOneAndUpdate({ match_id: id, team_id: match.team1_id }, { dot_balls: Math.max(0, Number(data.team1_dotball)) }, { upsert: true });
        if (data.team2_dotball !== undefined) await MatchDotBall.findOneAndUpdate({ match_id: id, team_id: match.team2_id }, { dot_balls: Math.max(0, Number(data.team2_dotball)) }, { upsert: true });

        if (data.team1_initial_dotball !== undefined) await MatchDotBall.findOneAndUpdate({ match_id: id, team_id: match.team1_id }, { initial_dot_balls: Math.max(0, Number(data.team1_initial_dotball)) }, { upsert: true });
        if (data.team2_initial_dotball !== undefined) await MatchDotBall.findOneAndUpdate({ match_id: id, team_id: match.team2_id }, { initial_dot_balls: Math.max(0, Number(data.team2_initial_dotball)) }, { upsert: true });

        await syncMatchLegacyFields(id);
    }

    res.json({ status: true, message: "Match updated", data: match });
});

export const getMatchDetails = asyncHandler(async (req, res) => {
    const { match_id } = getRequestParams(req, ['match_id']);
    if (!match_id) throw new ApiError(400, "match_id required");

    const match = await Match.findById(match_id).populate('team1_id team2_id winner_team_id', 'team_name team_logo team_short_name').lean();
    if (!match) throw new ApiError(404, "Match not found");

    const [t1s, t2s] = await Promise.all([
        Support.find({ match_id, team_id: match.team1_id._id || match.team1_id }).lean(),
        Support.find({ match_id, team_id: match.team2_id._id || match.team2_id }).lean()
    ]);

    res.json({
        status: true,
        data: {
            ...match,
            stats: {
                team1_trees: t1s.reduce((sum, s) => sum + (s.trees || 0), 0),
                team2_trees: t2s.reduce((sum, s) => sum + (s.trees || 0), 0)
            }
        }
    });
});

export const supportTrees = asyncHandler(async (req, res) => {
    let { user_id, match_id, dot_ball, team_id, plantation_id } = req.body;
    if (req.user?.id) user_id = req.user.id;

    if (plantation_id) {
        const plantation = await Plantation.findById(plantation_id);
        if (!plantation) throw new ApiError(404, "Plantation not found");
        return res.json(await executeSupportInternal(plantation));
    }

    if (!user_id || !match_id) throw new ApiError(400, "user_id and match_id are required");

    const match = await Match.findById(match_id).populate('team1_id team2_id tournament_id', 'team_name team_logo name').lean();
    if (!match) throw new ApiError(404, "Match not found");

    let targetId = team_id;
    if (!targetId) {
        const dbs = await MatchDotBall.find({ match_id }).lean();
        const map = new Map(dbs.map(d => [d.team_id.toString(), d.dot_balls]));
        const b1 = map.get(match.team1_id._id.toString()) || 0;
        const b2 = map.get(match.team2_id._id.toString()) || 0;
        targetId = (b1 >= b2) ? match.team1_id._id : match.team2_id._id;
    }

    // Dot ball inventory logic removed.
    // const ballRec = await MatchDotBall.findOne({ match_id, team_id: targetId }).lean();
    // if (Number(dot_ball) > (ballRec?.dot_balls || 0)) throw new ApiError(400, "Insufficient inventory");

    res.json({
        status: true,
        redirect_to_plantation: true,
        plantation_data: {
            user_id,
            trees_count: Number(dot_ball) || 0,
            amount: Number(dot_ball) ? Number(dot_ball) * 100 : 0,
            ipl_support: { support_type: 'match', match_id, team_id: targetId, tournament_id: match.tournament_id?._id }
        }
    });
});

export const getDotBallHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = getRequestParams(req, ['page', 'limit']);

    // SECURITY: Use token ID by default to prevent spoofing
    const isAdmin = ['admin', 'super_admin'].includes(req.user?.role);
    const user_id = (isAdmin && req.body.user_id) ? req.body.user_id : req.user?.id;

    if (!user_id) throw new ApiError(401, "Authentication required");

    const history = await Support.find({ user_id, support_type: { $in: ["team", "match"] } })
        .populate("team_id", "team_name team_logo")
        .populate("match_id")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean();

    const total = await Support.countDocuments({ user_id, support_type: { $in: ["team", "match"] } });
    res.json({ status: true, data: history, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
});

// --- Admin Tools ---

export const deleteMatch = asyncHandler(async (req, res) => {
    const id = req.body.id || req.body.match_id || req.query.id;
    if (!id) throw new ApiError(400, "Match ID required");

    await Match.findByIdAndDelete(id);
    await MatchDotBall.deleteMany({ match_id: id });

    res.json({ status: true, message: "Match deleted successfully" });
});

export const updateDotBalls = asyncHandler(async (req, res) => {
    const { match_id, team_id, dot_balls, initial_dot_balls } = req.body;
    if (!match_id || !team_id) throw new ApiError(400, "match_id and team_id required");

    const update = {};
    if (dot_balls !== undefined) update.dot_balls = Number(dot_balls);
    if (initial_dot_balls !== undefined) update.initial_dot_balls = Number(initial_dot_balls);

    await MatchDotBall.findOneAndUpdate(
        { match_id, team_id },
        update,
        { upsert: true }
    );

    await syncMatchLegacyFields(match_id);
    res.json({ status: true, message: "Dot balls updated" });
});

export const getMatchDotBalls = asyncHandler(async (req, res) => {
    const { match_id } = getRequestParams(req, ['match_id']);
    if (!match_id) throw new ApiError(400, "match_id required");

    const details = await MatchDotBall.find({ match_id }).populate('team_id', 'team_name').lean();
    res.json({ status: true, data: details });
});

export const uploadTeamImage = asyncHandler(async (req, res) => {
    const { team_id } = req.body;
    if (!team_id || !req.file) throw new ApiError(400, "team_id and image required");

    const team = await Team.findById(team_id);
    if (!team) throw new ApiError(404, "Team not found");

    if (team.team_logo) deleteFile(path.join(process.cwd(), 'public', team.team_logo));

    const imagePath = `/uploads/team/${req.file.filename}`;
    const updated = await Team.findByIdAndUpdate(team_id, { team_logo: imagePath }, { new: true });

    res.json({ status: true, message: "Team image uploaded", data: updated });
});

export const addTeamChallenge = asyncHandler(async (req, res) => {
    const { team_id, team_name, total_dot_balls, support_trees, total_trees } = req.body;
    const update = {};
    if (total_dot_balls !== undefined) update.total_dot_balls = total_dot_balls;
    if (support_trees !== undefined) update.support_trees = support_trees;
    if (total_trees !== undefined) update.total_trees = total_trees;

    let team;
    if (team_id) team = await Team.findByIdAndUpdate(team_id, update, { new: true });
    else if (team_name) team = await Team.findOneAndUpdate({ team_name }, update, { new: true, upsert: true });

    if (!team) throw new ApiError(404, "Team not found");
    res.json({ status: true, message: "Challenge updated", data: team });
});

// --- Cron Handlers ---

export const processPendingSettlements = async () => {
    try {
        if (mongoose.connection.readyState !== 1) return;
        const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);
        const matches = await Match.find({
            match_status: 'completed',
            pending_settled: { $ne: true },
            completed_at: { $lte: ONE_HOUR_AGO }
        });

        for (const match of matches) {
            await MatchDotBall.updateMany(
                { match_id: match._id, pending_trees: { $gt: 0 } },
                [{ $set: { dot_balls: { $subtract: ["$dot_balls", "$pending_trees"] }, pending_trees: 0 } }]
            );
            await Match.findByIdAndUpdate(match._id, { pending_settled: true });
            await syncMatchLegacyFields(match._id);
        }
    } catch (err) {
        console.error("[IPL Cron] Error settling matches:", err.message);
    }
};

// Alias exports for compatibility
export const getAllTeams = getTeamList;
export const getAllMatches = getMatchList;
