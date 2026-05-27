import State from "../models/state.model.js";
import path from "path";
import fs from "fs";
import multer from "multer";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { translateData } from "../utils/translation.util.js";
import { getRequestParams, parseBoolean } from "../utils/request.util.js";
import { deleteFile } from "../utils/file.util.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public/uploads/state');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `state-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

export const uploadStateImageMiddleware = upload.single('state_image');

// @desc    Get state list
export const getStateList = asyncHandler(async (req, res) => {
  const { lang, status, page = 1, limit = 10, search, sort = 'state_name' } = getRequestParams(req, ['lang', 'status', 'page', 'limit', 'search', 'sort']);
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

  const filter = {};
  if (status !== undefined) {
    filter.status = parseBoolean(status);
  } else if (!isAdmin) {
    filter.status = true;
  }

  if (search) {
    filter.state_name = { $regex: search, $options: 'i' };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
  const sortOrder = sort.startsWith('-') ? -1 : 1;

  const [states, total] = await Promise.all([
    State.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    State.countDocuments(filter)
  ]);

  let finalData = states;

  if (lang !== 'en') {
    finalData = await translateData(finalData, ['state_name', 'description'], lang);
  }


  res.json({
    status: true,
    message: "State list fetched",
    data: finalData,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    }
  });
});

// @desc    Get all states with districts and blocks hierarchy (non-paginated)
export const getHierarchy = asyncHandler(async (req, res) => {
  const { lang, status } = getRequestParams(req, ['lang', 'status']);

  const filter = {};
  if (status !== undefined) {
    filter.status = parseBoolean(status);
  } else {
    filter.status = true; // Default to active for dropdowns
  }

  const states = await State.find(filter)
    .select('state_name districts status')
    .sort({ state_name: 1 })
    .lean();

  let finalData = states;
  if (lang !== 'en') {
    finalData = await translateData(finalData, ['state_name'], lang);
  }

  res.json({
    status: true,
    message: "States hierarchy fetched successfully",
    data: finalData
  });
});

// @desc    Add new state
export const addState = asyncHandler(async (req, res) => {
  const { state_name, name, description, status } = req.body;
  const stateName = state_name || name;

  if (!stateName) throw new ApiError(400, "state_name is required");
  if (!req.file) throw new ApiError(400, "state_image is required");

  const state = await State.create({
    state_name: stateName,
    description,
    status: status !== undefined ? parseBoolean(status) : true,
    state_image: `/uploads/state/${req.file.filename}`
  });

  const stateObj = state.toObject();

  res.status(201).json({ status: true, message: "State added successfully", data: stateObj });
});

// @desc    Update state
export const updateState = asyncHandler(async (req, res) => {
  const id = req.body.id || req.query.id || req.params.id;
  if (!id) throw new ApiError(400, "id is required");

  const state = await State.findById(id);
  if (!state) throw new ApiError(404, "State not found");

  const updateSet = { ...req.body };

  if (!req.file && (req.body.state_image === "" || req.body.state_image === "null" || req.body.state_image === null)) {
    throw new ApiError(400, "state_image is required");
  }
  delete updateSet.state_image; // Protect image field from being overwritten by body text

  if (req.file) {
    if (state.state_image) deleteFile(state.state_image);
    updateSet.state_image = `/uploads/state/${req.file.filename}`;
  }

  if (updateSet.status !== undefined) updateSet.status = parseBoolean(updateSet.status);

  const updatedState = await State.findByIdAndUpdate(id, { $set: updateSet }, { new: true }).lean();

  res.json({ status: true, message: "State updated successfully", data: updatedState });
});

// @desc    Delete state
export const deleteState = asyncHandler(async (req, res) => {
  const id = req.body.id || req.query.id || req.params.id;
  if (!id) throw new ApiError(400, "id is required");

  const state = await State.findById(id);
  if (!state) throw new ApiError(404, "State not found");

  if (state.state_image) deleteFile(state.state_image);

  await State.findByIdAndDelete(id);
  res.json({ status: true, message: "State deleted successfully" });
});