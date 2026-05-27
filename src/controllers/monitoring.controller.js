import Monitoring from "../models/monitoring.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { getRequestParams } from "../utils/request.util.js";

// @desc    Get monitoring data
export const getMonitoringData = asyncHandler(async (req, res) => {
    const { site_id } = getRequestParams(req, ['site_id']);
    const query = site_id ? { site_id } : {};

    const data = await Monitoring.find(query).populate('site_id').sort({ monitoring_date: -1 }).lean();

    res.json({ status: true, message: "Monitoring data fetched", data: data });
});

// @desc    Add monitoring record
export const addMonitoringRecord = asyncHandler(async (req, res) => {
    const { site_id, monitoring_date, type, ai_stats, notes } = req.body;
    let media = [];
    if (req.files) {
        media = req.files.map(file => `/uploads/monitoring/${file.filename}`);
    }

    let parsedStats = ai_stats || {};
    if (typeof ai_stats === 'string') {
        try { parsedStats = JSON.parse(ai_stats); } catch (e) { }
    }

    const record = await Monitoring.create({
        site_id,
        monitoring_date,
        type,
        media,
        ai_stats: parsedStats,
        notes
    });

    const recordObj = record.toObject();

    res.status(201).json({ status: true, message: "Monitoring record added", data: recordObj });
});

// @desc    Update monitoring record
export const updateMonitoringRecord = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) throw new ApiError(400, "ID is required");

    const record = await Monitoring.findByIdAndUpdate(id, req.body, { new: true });
    if (!record) throw new ApiError(404, "Record not found");

    res.json({ status: true, message: "Monitoring record updated", data: record });
});

// @desc    Delete monitoring record
export const deleteMonitoringRecord = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) throw new ApiError(400, "ID is required");

    const record = await Monitoring.findByIdAndDelete(id);
    if (!record) throw new ApiError(404, "Record not found");

    res.json({ status: true, message: "Monitoring record deleted successfully" });
});
