import myUser from "../models/user.model.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { getRequestParams } from "../utils/request.util.js";
import Carbon from "../models/carbon.model.js";
import Plantation from "../models/plantation.model.js";

// --- Multer Configuration ---

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public/uploads/profile');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|heic|heif/;
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowed = allowedTypes.test(ext) || allowedTypes.test(file.mimetype);
    if (isAllowed) cb(null, true);
    else cb(new Error("Only image files are allowed!"));
  }
});

export const uploadMiddleware = (req, res, next) => {
  upload.single('profile_image')(req, res, (err) => {
    if (err) return res.status(400).json({ status: false, message: err.message });
    next();
  });
};

// --- Controllers ---

// @desc    Get profile
// Returns the user's profile + last carbon result + plantation counts in one call.
// This prevents the app from needing multiple API calls after login / re-login.
export const getProfile = asyncHandler(async (req, res) => {
  const { user_id } = getRequestParams(req, ['user_id']);

  // SECURITY FIX: Never use user_id from body for non-admin users
  const isAdmin = req.user?.type === 'admin' || req.user?.role === 'admin' || req.user?.role === 'super_admin';
  const targetId = (isAdmin && user_id) ? user_id : req.user?.id;

  if (!targetId) throw new ApiError(401, "Authentication required");

  // Type-safe ObjectId
  let oid;
  try {
    oid = new mongoose.Types.ObjectId(targetId);
  } catch (e) {
    throw new ApiError(400, "Invalid user_id format");
  }

  const user = await myUser.findById(oid).select('-otp -password -token').lean();
  if (!user) throw new ApiError(404, "User not found");


  // Enrich: fetch last carbon result + plantation summary in parallel
  const [lastCarbon, plantationCount] = await Promise.all([
    Carbon.findOne({ user_id: oid }).sort({ createdAt: -1 }).select('total total_tonnes breakdown species_recommendations carbon_result createdAt').lean(),
    Plantation.countDocuments({ user_id: oid })
  ]);

  res.json({
    status: true,
    message: "Profile fetched",
    data: {
      ...user,
      last_carbon_result: lastCarbon || null,
      plantation_count: plantationCount
    }
  });
});

// @desc    Update profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { user_id, name, email, profile_image, state } = req.body;

  // SECURITY FIX: Prevent spoofing
  const isAdmin = req.user?.type === 'admin' || req.user?.role === 'admin' || req.user?.role === 'super_admin';
  const targetId = (isAdmin && user_id) ? user_id : req.user?.id;

  if (!targetId) throw new ApiError(401, "Authentication required");

  const updateData = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (state) updateData.state = state;

  // Handle Base64 image
  let base64Data = null;
  let base64Type = 'image/jpeg';

  if (typeof profile_image === 'string' && profile_image.startsWith('data:image')) {
    const matches = profile_image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      base64Type = matches[1];
      base64Data = matches[2];
    }
  } else if (profile_image && typeof profile_image === 'object' && profile_image.base) {
    base64Data = profile_image.base;
    if (profile_image.type) base64Type = profile_image.type;
    if (base64Data.startsWith('data:image')) {
      const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        base64Type = matches[1];
        base64Data = matches[2];
      }
    }
  }

  if (base64Data) {
    const buffer = Buffer.from(base64Data, 'base64');
    const extension = base64Type.split('/')[1] || 'jpg';
    const fileName = `profile-base64-${Date.now()}.${extension}`;
    const uploadDir = path.join(process.cwd(), 'public/uploads/profile');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    updateData.profile_image = `/uploads/profile/${fileName}`;
  } else if (typeof profile_image === 'string' && !profile_image.startsWith('http')) {
    updateData.profile_image = profile_image;
  }

  if (req.file) {
    updateData.profile_image = `/uploads/profile/${req.file.filename}`;
  }

  const user = await myUser.findByIdAndUpdate(targetId, updateData, { new: true, select: '-otp -password -token' }).lean();
  if (!user) throw new ApiError(404, "User not found");


  res.json({ status: true, message: "Profile updated successfully", data: user });
});

// @desc    Upload profile image
export const uploadProfileImage = asyncHandler(async (req, res) => {
  const user_id = req.user?.id;
  if (!user_id) throw new ApiError(401, "Authentication required");

  if (!req.file) throw new ApiError(400, "Profile image is required");

  const imagePath = `/uploads/profile/${req.file.filename}`;
  const user = await myUser.findByIdAndUpdate(user_id, { profile_image: imagePath }, { new: true, select: '-otp -password -token' }).lean();

  if (!user) throw new ApiError(404, "User not found");

  const fullUrl = imagePath;
  res.json({
    status: true,
    message: "Profile image uploaded successfully",
    data: {
      user: { ...user, profile_image: fullUrl },
      image_url: fullUrl
    }
  });
});
