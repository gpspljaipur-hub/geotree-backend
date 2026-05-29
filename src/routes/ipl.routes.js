import express from 'express';
import * as iplController from '../controllers/ipl.controller.js';
import * as tournamentController from '../controllers/tournament.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import roleMiddleware from '../middleware/role.middleware.js';
import { body } from 'express-validator';
import validate from '../middleware/validate.middleware.js';
import { createUploadMiddleware } from '../middleware/upload.middleware.js';
import { decryptionMiddleware } from '../middleware/security.middleware.js';
import audit from '../middleware/audit.middleware.js';

const router = express.Router();

// Campaigns (Dot Ball Category)
// Get list of campaigns
router.all('/campaigns/list', decryptionMiddleware, authMiddleware, iplController.getCampaigns);

// Add a new campaign
router.post('/campaigns/add', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), audit('IPL', 'CREATE_CAMPAIGN'), iplController.addCampaign);

// Update a campaign
router.put('/campaigns/update', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), iplController.updateCampaign);

// Delete a campaign
router.delete('/campaigns/delete', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), iplController.deleteCampaign);

// Config
// Get configuration details
router.post('/config/details', decryptionMiddleware, authMiddleware, iplController.getConfig);

// Update configuration
router.put('/config', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), audit('IPL', 'UPDATE_CONFIG'), iplController.updateConfig);

// Tournaments
// Get list of tournaments
router.all('/tournaments/list', decryptionMiddleware, authMiddleware, tournamentController.getTournaments);
router.all('/tournaments/leaderboard', decryptionMiddleware, authMiddleware, iplController.getTournamentLeaderboard);

// Add a new tournament
router.post('/tournaments', createUploadMiddleware('tournament').single('image'), decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), audit('IPL', 'CREATE_TOURNAMENT'), tournamentController.addTournament);

// Update a tournament
router.put('/tournaments', createUploadMiddleware('tournament').single('image'), decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), audit('IPL', 'UPDATE_TOURNAMENT'), tournamentController.updateTournament);

// Delete a tournament (by URL param — for RESTful clients)
router.delete('/tournaments/:tournament_id', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), audit('IPL', 'DELETE_TOURNAMENT'), tournamentController.deleteTournament);
// Delete a tournament (by body id — consistent with other entity deletes)
router.delete('/tournaments/delete', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), audit('IPL', 'DELETE_TOURNAMENT'), tournamentController.deleteTournament);

// Teams
// Get list of teams
router.all('/teams/list', decryptionMiddleware, authMiddleware, iplController.getAllTeams);

// Add a new team
router.post('/teams', createUploadMiddleware('team').single('team_logo'), decryptionMiddleware, [
    authMiddleware,
    roleMiddleware(['super_admin', 'admin']),
    audit('IPL', 'CREATE_TEAM'),
    body('team_name').trim().notEmpty().withMessage('Team Name is required'),
    body('team_full_name').optional().trim(),
    body('team_color').optional(),
    body('primary_color').optional(),
    validate
], iplController.addTeam);

// Update a team
router.put('/teams/update', createUploadMiddleware('team').single('team_logo'), decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), audit('IPL', 'UPDATE_TEAM'), iplController.updateTeam);

// Delete a team
router.delete('/teams/delete', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), iplController.deleteTeam);

// Matches
// Get list of matches
router.all('/matches/list', decryptionMiddleware, authMiddleware, iplController.getAllMatches);

// Add a new match
router.post('/matches', createUploadMiddleware('ipl').none(), decryptionMiddleware, [
    authMiddleware,
    roleMiddleware(['super_admin', 'admin']),
    audit('IPL', 'CREATE_MATCH'),
    body('team1_id').isMongoId().withMessage('Valid Team 1 ID required'),
    body('team2_id').isMongoId().withMessage('Valid Team 2 ID required'),
    body('match_date').isISO8601().withMessage('Valid date format required (YYYY-MM-DD)'),
    body('match_time').notEmpty().withMessage('Match time is required'),
    body('venue').optional().isString(),
    body('match_type').optional().isIn(['League', 'Playoff', 'Final']).withMessage('Match type must be League, Playoff, or Final'),
    body('match_status').optional().isIn(['Upcoming', 'Live', 'Completed', 'upcoming', 'live', 'completed', 'ongoing', 'current']).withMessage('Invalid status'),
    validate
], iplController.addMatch);

// Update a match
router.put('/matches/update', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), audit('IPL', 'UPDATE_MATCH'), iplController.updateMatch);

// Delete a match
router.delete('/matches/delete', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), iplController.deleteMatch);

// Dot Balls
// Get dot balls details
router.post('/matches/dot-balls/details', decryptionMiddleware, authMiddleware, iplController.getMatchDotBalls);

// Update dot balls
router.put('/matches/dot-balls', decryptionMiddleware, [
    authMiddleware,
    roleMiddleware(['super_admin', 'admin']),
    audit('IPL', 'UPDATE_DOT_BALLS'),
    body('match_id').notEmpty().withMessage('Match ID required'),
    body('team_id').notEmpty().withMessage('Team ID required'),
    body('dot_balls').optional().isInt({ min: 0 }).withMessage('Dot balls must be a positive integer'),
    body('initial_dot_balls').optional().isInt({ min: 0 }).withMessage('Initial dot balls must be a positive integer'),
    validate
], iplController.updateDotBalls);

// Team details & Support (App)
router.post('/teams/details', decryptionMiddleware, authMiddleware, iplController.getTeamDetails);
router.post('/teams/support', decryptionMiddleware, authMiddleware, iplController.teamPreplantSupport);
router.post('/teams/upload-image', createUploadMiddleware('team').single('team_logo'), decryptionMiddleware, authMiddleware, iplController.uploadTeamImage); // Typically Admin but function exists

// Match Support (App)
router.post('/matches/support', decryptionMiddleware, authMiddleware, iplController.supportTrees);

// User History (App)
router.post('/history', decryptionMiddleware, authMiddleware, iplController.getDotBallHistory);

// Challenge / Leaderboard
router.all('/challenge', decryptionMiddleware, authMiddleware, iplController.teamChallenge);
router.post('/challenge/update', decryptionMiddleware, authMiddleware, roleMiddleware(['super_admin', 'admin']), iplController.addTeamChallenge);

export default router;
