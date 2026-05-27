import mongoose from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";
import "../models/allModels.js";

// @desc    Get all registered models and their schemas with actual document counts
export const getModels = asyncHandler(async (req, res) => {
    const models = Object.keys(mongoose.models);
    const modelDetails = await Promise.all(models.map(async name => {
        const model = mongoose.model(name);
        const paths = model.schema.paths;
        const schema = {};

        for (let path in paths) {
            if (path === "__v") continue;
            schema[path] = {
                type: paths[path].instance,
                required: paths[path].isRequired || false,
                ref: paths[path].options.ref || null,
                enumValues: paths[path].enumValues || null
            };
        }

        // OPTIMIZATION: Get actual count for the dashboard list
        const count = await model.countDocuments();

        return {
            name,
            totalDocs: count,
            schema
        };
    }));

    res.status(200).json({
        status: true,
        data: modelDetails
    });
});

// @desc    Get records for a specific model with pagination, search, and filter
export const getModelRecords = asyncHandler(async (req, res) => {
    const { modelName } = req.params;
    const { page = 1, limit = 10, search, sortField, sortOrder = 'desc' } = req.method === 'POST' ? req.body : req.query;

    if (!mongoose.models[modelName]) {
        return res.status(404).json({ status: false, message: "Model not found" });
    }

    const Model = mongoose.model(modelName);
    const filter = {};

    if (search) {
        const searchPaths = Object.keys(Model.schema.paths).filter(p =>
            Model.schema.paths[p].instance === 'String' && p !== '_id'
        );
        if (searchPaths.length > 0) {
            filter.$or = searchPaths.map(p => ({ [p]: { $regex: search, $options: 'i' } }));
        }
    }

    const sort = {};
    if (sortField) {
        sort[sortField] = sortOrder === 'asc' ? 1 : -1;
    } else if (Model.schema.paths.createdAt) {
        sort.createdAt = -1;
    }

    // Auto-populate any ObjectId fields that have a reference (ref)
    const populatePaths = Object.keys(Model.schema.paths).filter(p =>
        Model.schema.paths[p].options && Model.schema.paths[p].options.ref
    );

    let query = Model.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(Number(limit));

    if (populatePaths.length > 0) {
        query = query.populate(populatePaths.join(' '));
    }

    const records = await query.lean();

    const total = await Model.countDocuments(filter);

    res.status(200).json({
        status: true,
        data: records,
        meta: {
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            limit: Number(limit)
        }
    });
});

// @desc    Get a single record
export const getRecordById = asyncHandler(async (req, res) => {
    const { modelName, id } = req.params;
    if (!mongoose.models[modelName]) return res.status(404).json({ status: false, message: "Model not found" });

    const Model = mongoose.model(modelName);
    const record = await Model.findById(id).lean();
    if (!record) return res.status(404).json({ status: false, message: "Record not found" });
    res.status(200).json({ status: true, data: record });
});

// @desc    Create a new record
export const createRecord = asyncHandler(async (req, res) => {
    const { modelName } = req.params;
    if (!mongoose.models[modelName]) return res.status(404).json({ status: false, message: "Model not found" });

    const Model = mongoose.model(modelName);
    const newRecord = await Model.create(req.body);
    res.status(201).json({ status: true, data: newRecord });
});

// @desc    Update a record
export const updateRecord = asyncHandler(async (req, res) => {
    const { modelName, id } = req.params;
    if (!mongoose.models[modelName]) return res.status(404).json({ status: false, message: "Model not found" });

    const Model = mongoose.model(modelName);
    const updatedRecord = await Model.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).lean();
    if (!updatedRecord) return res.status(404).json({ status: false, message: "Record not found" });
    res.status(200).json({ status: true, data: updatedRecord });
});

// @desc    Delete a record
export const deleteRecord = asyncHandler(async (req, res) => {
    const { modelName, id } = req.params;
    if (!mongoose.models[modelName]) return res.status(404).json({ status: false, message: "Model not found" });

    const Model = mongoose.model(modelName);
    const deletedRecord = await Model.findByIdAndDelete(id);
    if (!deletedRecord) return res.status(404).json({ status: false, message: "Record not found" });
    res.status(200).json({ status: true, message: "Record deleted successfully" });
});
