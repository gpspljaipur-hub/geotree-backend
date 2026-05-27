import AuditLog from '../models/auditLog.model.js';
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { getRequestParams } from "../utils/request.util.js";

// @desc    Get All Audit Logs
export const getLogs = asyncHandler(async (req, res) => {
    const { module, action, admin_id, limit = 100 } = getRequestParams(req, ['module', 'action', 'admin_id', 'limit']);

    let query = {};
    if (module) query.module = module;
    if (action) query.action = action;
    if (admin_id) query.admin_id = admin_id;

    const logs = await AuditLog.find(query)
        .populate('admin_id', 'name email role')
        .sort({ created_at: -1 })
        .limit(Number(limit));

    res.json({ status: true, message: "Audit logs fetched", data: logs });
});

// @desc    Create Audit Log (Internal Helper)
export const createLog = async (data) => {
    try {
        await AuditLog.create(data);
    } catch (err) {
        console.error("Audit Log Creation Failed:", err);
    }
};
