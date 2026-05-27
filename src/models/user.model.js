import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: false
    },
    email: {
        type: String,
        required: false,
        index: true
    },
    privacy_policy: {
        type: Boolean,
        required: false,
        default: false
    },
    // password field kept for backward compatibility only — system is OTP-only
    // Do not use for authentication. Will be removed in a future cleanup.
    password: {
        type: String,
        required: false,
        select: false // never returned in queries unless explicitly requested
    },
    token: {
        type: String,
        required: false
    },
    tokens: {
        type: [String],
        default: []
    },
    device_token: {
        type: String,
        required: false
    },
    mobile: {
        type: Number,
        required: true
        // Index declared below via UserSchema.index() — do not add index:true here (duplicate)
    },
    // FIX: mobile_verified was missing from schema but was being written by signup controller
    mobile_verified: {
        type: Boolean,
        required: false,
        default: false
    },
    email_verified: {
        type: Boolean,
        required: false,
        default: false
    },
    number_verified: {
        type: Boolean,
        required: false,
        default: false
    },
    // FIX: otp now stores HASHED value (SHA-256), never plain-text
    otp: {
        type: String, // Changed from Number to String to store hash
        required: false,
        select: false // never returned in queries
    },
    amount: {
        type: Number,
        required: false,
        default: 0
    },
    name: {
        type: String,
        required: false
    },
    profile_image: {
        type: String,
        required: false
    },
    state: {
        type: String,
        required: false
    },
    carbon_footprint: {
        type: Number,
        required: false,
        default: 0
    },
    status: {
        type: Boolean,
        default: true,
        index: true
    },
    last_login: {
        type: Date,
        default: null
    }
}, { timestamps: true });

UserSchema.index({ mobile: 1 }, { unique: true });
UserSchema.index({ device_token: 1 });

const User = mongoose.models.users || mongoose.models['users'] || mongoose.model('users', UserSchema);
export default User;
