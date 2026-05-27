import Tournament from "../models/tournament.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { translateData } from "../utils/translation.util.js";
import { getRequestParams, parseBoolean } from "../utils/request.util.js";
import { deleteFile } from "../utils/file.util.js";

// @desc    Add tournament
export const addTournament = asyncHandler(async (req, res) => {
  const { name, short_name, description, start_date, end_date, venue, status, tournament_status } = req.body;
  if (!name || !start_date) throw new ApiError(400, "name and start_date are required");

  const data = {
    name,
    short_name,
    description,
    start_date,
    end_date,
    venue,
    status: status !== undefined ? parseBoolean(status) : true,
    tournament_status: tournament_status || "upcoming"
  };
  if (req.file) data.image = `/uploads/tournament/${req.file.filename}`;

  const tournament = await Tournament.create(data);
  const tournamentObj = tournament.toObject();

  res.status(201).json({ status: true, message: "Tournament created successfully", data: tournamentObj });
});

// @desc    Get tournaments
export const getTournaments = asyncHandler(async (req, res) => {
  const { lang = 'en', status, page = 1, limit = 10, sort = '-createdAt' } = getRequestParams(req, ['lang', 'status', 'page', 'limit', 'sort']);
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

  const filter = {};
  if (status !== undefined) filter.status = parseBoolean(status);
  else if (!isAdmin) filter.status = true;

  const skip = (Number(page) - 1) * Number(limit);
  const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
  const sortOrder = sort.startsWith('-') ? -1 : 1;

  const [tournaments, total] = await Promise.all([
    Tournament.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Tournament.countDocuments(filter)
  ]);

  let finalData = tournaments;
  if (lang !== 'en') {
    finalData = await translateData(finalData, ['name', 'short_name', 'description', 'venue'], lang);
  }

  const normalizedData = finalData.map(t => ({ ...t, id: t._id }));

  res.json({
    status: true,
    message: "Tournaments fetched successfully",
    data: normalizedData,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Update tournament
export const updateTournament = asyncHandler(async (req, res) => {
  const id = req.body.tournament_id || req.body.id || req.params.tournament_id;
  if (!id) throw new ApiError(400, "tournament_id is required");

  const tournament = await Tournament.findById(id);
  if (!tournament) throw new ApiError(404, "Tournament not found");

  const updateData = { ...req.body };
  if (updateData.status !== undefined) updateData.status = parseBoolean(updateData.status);

  if (req.file) {
    if (tournament.image) deleteFile(tournament.image);
    updateData.image = `/uploads/tournament/${req.file.filename}`;
  }

  const updatedTournament = await Tournament.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();

  res.json({ status: true, message: "Tournament updated successfully", data: updatedTournament });
});

// @desc    Delete tournament
export const deleteTournament = asyncHandler(async (req, res) => {
  const id = req.body.tournament_id || req.body.id || req.params.tournament_id;
  if (!id) throw new ApiError(400, "ID is required");

  const tournament = await Tournament.findById(id);
  if (!tournament) throw new ApiError(404, "Tournament not found");

  if (tournament.image) deleteFile(tournament.image);

  await Tournament.findByIdAndDelete(id);

  res.json({ status: true, message: "Tournament deleted successfully" });
});
