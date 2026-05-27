import mongoose from "mongoose";

/**
 * OTP Model — replaces in-memory Map for OTP storage.
 * Works across multiple Node.js workers (PM2 cluster mode).
 * Stores hashed OTP with TTL-based auto-expiry via MongoDB TTL index.
 */
const OtpSchema = new mongoose.Schema({
  mobile: {
    type: Number,
    required: true
    // unique index declared below via OtpSchema.index() — do not add index:true here
  },
  hashed_otp: {
    type: String,
    required: true
  },
  is_existing_user: {
    type: Boolean,
    default: false
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    default: null
  },
  device_token: {
    type: String,
    default: null
  },
  // TTL: MongoDB will automatically delete the document after 10 minutes
  expires_at: {
    type: Date,
    default: () => new Date(Date.now() + 10 * 60 * 1000)
  }
}, { timestamps: true });

// MongoDB TTL Index — auto-deletes expired OTP documents
OtpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
// Unique per mobile — only one pending OTP at a time
OtpSchema.index({ mobile: 1 }, { unique: true });

export default mongoose.models["Otp"] || mongoose.model("Otp", OtpSchema);
