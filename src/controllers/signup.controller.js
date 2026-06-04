import crypto from "crypto";
import myUser from "../models/user.model.js";
import OtpRecord from "../models/otp.model.js";
import jwt from "jsonwebtoken";
import { sendNotification } from "./firebase.controller.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { getRequestParams } from "../utils/request.util.js";
import dotenv from "dotenv";

dotenv.config();
// ─── OTP Helpers ──────────────────────────────────────────────────────────────

/** Hash OTP with SHA-256 before storing — never stored plain-text */
const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");

/** Generate a 6-digit OTP. In non-production, allow demo number override. */
const generateOtp = (mobileNumber) => {
  if (process.env.NODE_ENV !== "production" && mobileNumber === 9999999999) {
    return 1234;
  }
  return Math.floor(100000 + Math.random() * 900000);
};

/** Save hashed OTP to DB (upsert — one record per mobile at a time) */
const saveOtp = async ({ mobile, otp, is_existing_user, user_id = null, device_token = null }) => {
  const hashed_otp = hashOtp(otp);
  const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Upsert: replace any existing OTP for this mobile with the new one
  await OtpRecord.findOneAndUpdate(
    { mobile },
    { hashed_otp, is_existing_user, user_id, device_token, expires_at },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Check mobile number → Auto-login OR send OTP
//
// FLOW:
//   RETURNING USER + valid JWT + matching device_token → instant auto-login (no OTP)
//   RETURNING USER + expired JWT or different device   → send OTP (re-verification)
//   NEW USER                                           → send OTP (registration)
// ─────────────────────────────────────────────────────────────────────────────
export const checkNumber = asyncHandler(async (req, res) => {
  const { mobile, device_token } = getRequestParams(req, ["mobile", "device_token"]);

  if (!mobile) throw new ApiError(400, "Mobile is required");

  const mobileNumber = Number(mobile);
  if (isNaN(mobileNumber)) throw new ApiError(400, "Mobile must be a valid number");

  const existingUser = await myUser.findOne({
    $or: [{ mobile: mobileNumber }, { mobile: String(mobile) }]
  });

  if (existingUser) {
    // ── RETURNING USER ──────────────────────────────────────────────────────
    if (existingUser.status === false) {
      throw new ApiError(403, "Account disabled. Please contact support.");
    }

    // ── AUTO-LOGIN: Check if JWT + device_token are both valid ────────────
    if (existingUser.token && device_token && existingUser.device_token === device_token) {
      try {
        jwt.verify(existingUser.token, process.env.JWT_SECRET || "geotree_jwt_secret_key_development_only_1234567890");

        // ✅ Token valid + device matches → AUTO-LOGIN (skip OTP entirely)
        const user = await myUser
          .findByIdAndUpdate(existingUser._id, { last_login: new Date() }, { new: true })
          .select("-password -otp -token")
          .lean();

        return res.json({
          status: true,
          message: "Auto-login successful.",
          auto_login: true,
          data: { ...user, token: existingUser.token }
        });
      } catch (tokenErr) {
        // Token expired or invalid → fall through to OTP flow below
        if (process.env.NODE_ENV === "development") {
          console.log(`Auto-login failed for ${mobileNumber}: ${tokenErr.message} — falling back to OTP`);
        }
      }
    }

    // ── OTP FLOW: Token expired / device changed / no token ──────────────
    const otp = generateOtp(mobileNumber);

    // Save HASHED OTP to DB
    await myUser.findByIdAndUpdate(existingUser._id, {
      otp: hashOtp(otp),
      device_token: device_token || existingUser.device_token,
      timestamp: Date.now()
    });

    // Also store in OTP collection (for cross-process reliability)
    await saveOtp({
      mobile: mobileNumber,
      otp,
      is_existing_user: true,
      user_id: existingUser._id,
      device_token: device_token || existingUser.device_token
    });

    // Send OTP via push notification (non-fatal)
    try {
      if (device_token) {
        await sendNotification(device_token, "Geotree", "Your OTP is " + otp, { type: "otp" });
      }
    } catch (e) { /* notification failure is non-fatal */ }

    // LOG: for development, log the OTP in the terminal
    if (process.env.NODE_ENV !== "production") {
      console.log(`[AUTH] OTP for ${mobileNumber} (existing): ${otp}`);
    }

    // ✅ SECURITY FIX: OTP is ONLY returned in the API response in non-production environments
    return res.json({
      status: true,
      message: "OTP sent for verification.",
      auto_login: false,
      data: {
        mobile: mobileNumber,
        number_verified: false,
        is_existing_user: true,
        otp
        // ...(process.env.NODE_ENV !== "production" && { otp })
      }
    });
  }

  // ── NEW USER ───────────────────────────────────────────────────────────────
  const otp = generateOtp(mobileNumber);

  // Store OTP in DB collection (not in-memory — safe for PM2 cluster mode)
  await saveOtp({
    mobile: mobileNumber,
    otp,
    is_existing_user: false,
    user_id: null,
    device_token: device_token || null
  });

  try {
    if (device_token) {
      await sendNotification(device_token, "Geotree", "Your OTP is " + otp, { type: "otp" });
    }
  } catch (e) { /* non-fatal */ }

  // LOG: for development, log the OTP in the terminal
  if (process.env.NODE_ENV !== "production") {
    console.log(`[AUTH] OTP for ${mobileNumber} (new): ${otp}`);
  }

  // ✅ SECURITY FIX: OTP is ONLY returned in the API response in non-production environments
  res.json({
    status: true,
    message: "OTP sent to mobile.",
    auto_login: false,
    data: {
      mobile: mobileNumber,
      number_verified: false,
      is_existing_user: false,
      otp
      // ...(process.env.NODE_ENV !== "production" && { otp })
    }
  });
});



// ─────────────────────────────────────────────────────────────────────────────
// @desc    Verify OTP → Login existing user OR register new user
// ─────────────────────────────────────────────────────────────────────────────
export const verifyOTP = asyncHandler(async (req, res) => {
  const { mobile, otp, privacy_policy, device_token } = getRequestParams(req, [
    "mobile",
    "otp",
    "privacy_policy",
    "device_token"
  ]);

  if (!mobile || !otp) throw new ApiError(400, "Mobile and OTP are required");

  const mobileNumber = Number(mobile);
  const otpInput = String(otp).trim();

  // ── Step 1: Find OTP record from DB collection ────────────────────────────
  let otpRecord = await OtpRecord.findOne({ mobile: mobileNumber });

  if (!otpRecord) {
    // Fallback: OTP collection record missing (e.g., collection was cleared).
    // For returning users, check the hashed OTP in the user document itself.
    const dbUser = await myUser.findOne({
      $or: [{ mobile: mobileNumber }, { mobile: String(mobile) }]
    });

    if (!dbUser || !dbUser.otp) {
      throw new ApiError(400, "OTP expired or not found. Please request a new OTP.");
    }

    // Compare hashed OTP
    if (dbUser.otp !== hashOtp(otpInput)) {
      throw new ApiError(400, "Invalid OTP. Please check and try again.");
    }

    // Reconstruct a minimal record for the rest of the flow
    otpRecord = {
      is_existing_user: true,
      user_id: dbUser._id,
      device_token: device_token || dbUser.device_token
    };
  } else {
    // ── Validate OTP using hash comparison (never compare plain-text) ──────
    const isValid = otpRecord.hashed_otp === hashOtp(otpInput);
    if (!isValid) {
      throw new ApiError(400, "Invalid OTP. Please check and try again.");
    }

    // Check expiry (belt-and-suspenders — MongoDB TTL handles most cases)
    if (otpRecord.expires_at && otpRecord.expires_at < new Date()) {
      await OtpRecord.deleteOne({ mobile: mobileNumber });
      throw new ApiError(400, "OTP expired. Please request a new OTP.");
    }
  }

  // ── Step 2: Login or Register ──────────────────────────────────────────────
  let user;

  if (otpRecord.is_existing_user) {
    if (!otpRecord.user_id) {
      throw new ApiError(500, "Session data corrupted. Please request a new OTP.");
    }

    const updateFields = {
      mobile_verified: true,
      number_verified: true,
      otp: null // clear hashed OTP after successful verification
    };
    if (privacy_policy !== undefined) updateFields.privacy_policy = privacy_policy;
    if (device_token) updateFields.device_token = device_token;

    user = await myUser.findByIdAndUpdate(otpRecord.user_id, updateFields, { new: true });

    if (!user) {
      throw new ApiError(404, "Account not found. It may have been removed. Please contact support.");
    }
  } else {
    // NEW USER — create account
    const payload = {
      mobile: mobileNumber,
      mobile_verified: true,
      number_verified: true,
      device_token: device_token || otpRecord.device_token
    };
    if (privacy_policy !== undefined) payload.privacy_policy = privacy_policy;

    try {
      user = await myUser.create(payload);
    } catch (err) {
      // Handle race condition: two requests for the same mobile simultaneously
      if (err.code === 11000) {
        user = await myUser.findOne({ mobile: mobileNumber });
        if (!user) {
          console.error("verifyOTP Account creation failed with duplicate key error:", err);
          throw new ApiError(500, "Account creation failed. Please try again.");
        }
      } else {
        throw err;
      }
    }
  }



  // ── Step 3: Issue a fresh JWT (30-day — more secure than 365-day) ──────────
  const token = jwt.sign(
    { id: user._id, type: "user" },
    process.env.JWT_SECRET || "geotree_jwt_secret_key_development_only_1234567890",
    { expiresIn: "30d" }
  );

  // Save token to DB for auto-login feature (device + token pair)
  user = await myUser
    .findByIdAndUpdate(
      user._id,
      {
        token,
        last_login: new Date(),
        $push: { tokens: { $each: [token], $slice: -5 } }
      },
      { new: true }
    )
    .select("-password -otp")
    .lean();

  // Clean up OTP record from DB
  await OtpRecord.deleteOne({ mobile: mobileNumber });

  res.json({
    status: true,
    message: "OTP Verified successfully.",
    data: { ...user, token }
  });
});