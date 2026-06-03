import jwt from "jsonwebtoken";
import myUser from "../models/user.model.js";

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ status: false, message: "Authentication required" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "geotree_jwt_secret_key_development_only_1234567890");

        // Debug logging only in development
        if (process.env.NODE_ENV === 'development') {
            console.log("AuthMiddleware: Decoded Token:", { id: decoded.id, role: decoded.role });
        }

        // Normalize payload: Support 'id', 'adminId', and 'user_id' for backward compatibility
        decoded.id = decoded.id || decoded.adminId || decoded.user_id;

        if (!decoded.id) {
            return res.status(401).json({ status: false, message: "Invalid token payload" });
        }

        req.user = decoded; // { id, role, type }

        // if (decoded.type === "user") {
        //     const user = await myUser.findById(decoded.id).select('token tokens status').lean();
        //     if (!user || user.status === false) {
        //         return res.status(401).json({ status: false, message: "Account disabled. Please contact support." });
        //     }
        //     const tokenList = Array.isArray(user.tokens) ? user.tokens : [];
        //     const tokenMatches = tokenList.includes(token) || user.token === token;
        //     if (!tokenMatches) {
        //         return res.status(401).json({ status: false, message: "Session expired. Please log in again." });
        //     }
        // }

        next();
    } catch (err) {
        if (process.env.NODE_ENV === 'development') {
            console.log("AuthMiddleware Error:", err.message);
        }

        // Differentiate expired tokens from invalid tokens
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ status: false, message: "Token expired. Please log in again." });
        }
        return res.status(401).json({ status: false, message: "Invalid token" });
    }
};

export default authMiddleware;
