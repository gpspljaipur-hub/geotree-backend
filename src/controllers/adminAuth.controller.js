import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from 'crypto';
import otpGenerator from 'otp-generator';
import Admin from "../models/admin.model.js";
import LoginLog from "../models/loginLog.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { getRequestParams } from "../utils/request.util.js";
import { sendEmail } from "../utils/email.util.js";
import dotenv from "dotenv";

dotenv.config();


// @desc    Admin Login
export const adminLogin = asyncHandler(async (req, res) => {
    const { email, password } = getRequestParams(req, ['email', 'password']);

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
        throw new ApiError(400, "Invalid credentials");
    }

    if (admin.status === false) {
        throw new ApiError(403, "Account disabled");
    }

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
        admin.failed_login_attempts = (admin.failed_login_attempts || 0) + 1;
        await admin.save();

        await LoginLog.create({
            admin_id: admin._id,
            ip_address: req.ip || '0.0.0.0',
            role: admin.role,
            status: 'Failed'
        });

        throw new ApiError(400, "Invalid credentials");
    }

    // Success
    admin.failed_login_attempts = 0;
    admin.last_login_at = new Date();
    admin.locked_until = null;
    await admin.save();

    await LoginLog.create({
        admin_id: admin._id,
        ip_address: req.ip || '0.0.0.0',
        role: admin.role,
        status: 'Success'
    });

    const token = jwt.sign(
        { id: admin._id, role: admin.role, type: 'admin' },
        process.env.JWT_SECRET || "geotree_jwt_secret_key_development_only_1234567890",
        { expiresIn: "12h" }
    );

    res.json({
        status: true,
        message: "Login successful",
        data: {
            token,
            admin: {
                id: admin._id,
                name: admin.name || "Admin",
                email: admin.email,
                role: admin.role,
                image: admin.image
            }
        }
    });
});

// @desc    Request Password Reset OTP
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = getRequestParams(req, ['email']);

    // 1. Validate Input
    if (!email) {
        throw new ApiError(400, "Registered email is required");
    }

    // 2. Find Admin (Case-insensitive)
    const admin = await Admin.findOne({ email: email.toLowerCase() });

    // Security Note: In high-security systems, we might return success even if email doesn't exist 
    // to avoid account enumeration. But for internal admin panels, a clear error is often more helpful.
    if (!admin) {
        throw new ApiError(404, "No admin account found with this email");
    }

    // 3. Generate Secure 6-digit OTP
    const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        specialChars: false,
        lowerCaseAlphabets: false,
        digits: true
    });

    // 4. Save to Database with 10-minute expiry
    admin.reset_password_token = otp;
    admin.reset_password_expires = Date.now() + (10 * 60 * 1000); // 10 Minutes
    await admin.save();

    // 5. Send Professional OTP Email
    try {
        await sendEmail({
            to: admin.email,
            subject: 'Action Required: GeoTree Admin Password Reset',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 20px auto; padding: 40px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff; color: #333;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2e7d32; margin: 0; font-size: 28px;">🌳 GeoTree</h1>
                        <p style="color: #666; font-size: 14px; margin-top: 5px;">Admin Control Center</p>
                    </div>
                    
                    <h2 style="color: #1b5e20; font-size: 20px; border-bottom: 2px solid #f1f8e9; padding-bottom: 10px;">Secure One-Time Password</h2>
                    
                    <p style="font-size: 16px; line-height: 1.6;">Hello <strong>${admin.name}</strong>,</p>
                    <p style="font-size: 16px; line-height: 1.6;">We received a request to reset your admin password. Use the code below to complete the verification process:</p>
                    
                    <div style="background-color: #f9f9f9; border: 2px dashed #2e7d32; padding: 25px; border-radius: 8px; text-align: center; margin: 30px 0;">
                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #2e7d32; font-family: 'Courier New', Courier, monospace;">${otp}</span>
                    </div>
                    
                    <p style="font-size: 14px; color: #d32f2f; font-weight: bold;">⚠️ This code will expire in 10 minutes.</p>
                    
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 13px; color: #888;">
                        <p><strong>Note:</strong> If you did not request this password reset, please change your password immediately or contact the system administrator, as this may indicate a security concern.</p>
                        <p style="text-align: center; margin-top: 30px;">&copy; ${new Date().getFullYear()} GeoTree Platform. All rights reserved.</p>
                    </div>
                </div>
            `
        });

        res.json({
            status: true,
            message: "A 6-digit verification code has been sent to your registered email."
        });

    } catch (error) {
        console.error("CRITICAL: Failed to send password reset email:", error);

        // Clear the token since it wasn't sent
        admin.reset_password_token = undefined;
        admin.reset_password_expires = undefined;
        await admin.save();

        throw new ApiError(500, "Unable to deliver OTP via email. Please check your connectivity or contact support.");
    }
});

// @desc    Verify Reset OTP
export const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp } = getRequestParams(req, ['email', 'otp']);
    if (!email || !otp) throw new ApiError(400, "Email and OTP are required");

    const admin = await Admin.findOne({
        email: email.toLowerCase(),
        reset_password_token: otp,
        reset_password_expires: { $gt: Date.now() }
    });

    if (!admin) {
        throw new ApiError(400, "Invalid or expired OTP");
    }

    res.json({
        status: true,
        message: "OTP verified successfully. You can now reset your password.",
        data: { email, otp } // Frontnd will use these for the next step
    });
});

// @desc    Reset Password with OTP
export const resetPassword = asyncHandler(async (req, res) => {
    const { email, otp, new_password } = getRequestParams(req, ['email', 'otp', 'new_password']);
    if (!email || !otp || !new_password) throw new ApiError(400, "Email, OTP and new password are required");

    const admin = await Admin.findOne({
        email: email.toLowerCase(),
        reset_password_token: otp,
        reset_password_expires: { $gt: Date.now() }
    });

    if (!admin) throw new ApiError(400, "Invalid or expired OTP");

    const salt = await bcrypt.genSalt(10);
    admin.password_hash = await bcrypt.hash(new_password, salt);
    admin.reset_password_token = undefined;
    admin.reset_password_expires = undefined;

    await admin.save();

    res.json({ status: true, message: "Password updated successfully. Please login with your new password." });
});
// @desc    Admin Logout
export const adminLogout = asyncHandler(async (req, res) => {
    res.json({
        status: true,
        message: "Logout successful"
    });
});
