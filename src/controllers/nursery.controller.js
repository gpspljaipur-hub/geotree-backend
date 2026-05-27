import Nursery from "../models/nursery.model.js";
import path from "path";
import fs from "fs";
import asyncHandler from "../utils/asyncHandler.js";
import { translateData } from "../utils/translation.util.js";
import { getRequestParams, parseBoolean } from "../utils/request.util.js";
import { deleteFile } from "../utils/file.util.js";

// @desc    Get all nurseries
export const getNurseryList = asyncHandler(async (req, res) => {
    const { lang, status, page = 1, limit = 10, search, sort = 'name' } = getRequestParams(req, ['lang', 'status', 'page', 'limit', 'search', 'sort']);
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

    const filter = {};
    if (status !== undefined) {
        filter.status = parseBoolean(status);
    } else if (!isAdmin) {
        filter.status = true;
    }

    if (search) {
        filter.name = { $regex: search, $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;

    const [nurseries, total] = await Promise.all([
        Nursery.find(filter)
            .populate('stock.plant_id')
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
        Nursery.countDocuments(filter)
    ]);

    let finalData = nurseries.map(n => ({
        ...n,
        location: `${n.lat}, ${n.lng}`,
        ownershipType: n.ownership_type,
        khasraId: n.khasra_id,
        speciesList: n.stock ? n.stock.map(s => ({
            speciesId: s.plant_id?._id || s.plant_id,
            quantity: s.count
        })) : []
    }));

    if (lang !== 'en') {
        finalData = await translateData(finalData, ['name', 'address', 'description'], lang);
    }


    res.json({
        status: true,
        message: "Nursery list fetched",
        data: finalData,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
        }
    });
});

// @desc    Add a new nursery
export const addNursery = asyncHandler(async (req, res) => {
    const { name, location, ownershipType, khasraId, speciesList, status, address, description } = req.body;

    if (!name) return res.status(400).json({ status: false, message: "Nursery name is required" });

    const nursery_image = req.file ? `/uploads/nursery/${req.file.filename}` : null;

    let parsedStock = [];
    if (speciesList) {
        try {
            const list = typeof speciesList === 'string' ? JSON.parse(speciesList) : speciesList;
            if (Array.isArray(list)) {
                parsedStock = list.map(item => ({ plant_id: item.speciesId, count: Number(item.quantity) || 0 }));
            }
        } catch (e) {
            console.error("Stock parse error:", e.message);
        }
    }

    let lat = 0, lng = 0;
    if (location) {
        const parts = String(location).split(',');
        lat = Number(parts[0]?.trim()) || 0;
        lng = Number(parts[1]?.trim()) || 0;
    }

    const newNursery = await Nursery.create({
        name,
        lat,
        lng,
        ownership_type: ownershipType,
        khasra_id: khasraId,
        address,
        description,
        nursery_image,
        status: status !== undefined ? parseBoolean(status) : true,
        stock: parsedStock
    });
    const nurseryObj = newNursery.toObject();

    res.status(201).json({ status: true, message: "Nursery added successfully", data: nurseryObj });
});

// @desc    Update a nursery
export const updateNursery = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) return res.status(400).json({ status: false, message: "ID required" });

    const nursery = await Nursery.findById(id);
    if (!nursery) return res.status(404).json({ status: false, message: "Nursery not found" });

    const { name, location, ownershipType, khasraId, speciesList, status, address, description } = req.body;

    let lat = nursery.lat, lng = nursery.lng;
    if (location) {
        const parts = String(location).split(',');
        lat = Number(parts[0]?.trim()) || lat;
        lng = Number(parts[1]?.trim()) || lng;
    }

    let updateData = { name, lat, lng, ownership_type: ownershipType, khasra_id: khasraId, address, description };

    if (status !== undefined) updateData.status = parseBoolean(status);

    if (!req.file && (req.body.nursery_image === "" || req.body.nursery_image === "null" || req.body.nursery_image === null)) {
        if (nursery.nursery_image) deleteFile(nursery.nursery_image);
        updateData.nursery_image = null;
    }

    if (req.file) {
        if (nursery.nursery_image) deleteFile(nursery.nursery_image);
        updateData.nursery_image = `/uploads/nursery/${req.file.filename}`;
    }

    if (speciesList) {
        try {
            const list = typeof speciesList === 'string' ? JSON.parse(speciesList) : speciesList;
            if (Array.isArray(list)) {
                updateData.stock = list.map(item => ({ plant_id: item.speciesId, count: Number(item.quantity) || 0 }));
            }
        } catch (e) {
            console.error("Stock update parse error:", e.message);
        }
    }

    const updatedNursery = await Nursery.findByIdAndUpdate(id, updateData, { new: true });
    const nurseryObj = updatedNursery.toObject();

    res.json({ status: true, message: "Nursery updated successfully", data: nurseryObj });
});

// @desc    Delete a nursery
export const deleteNursery = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) return res.status(400).json({ status: false, message: "ID required" });

    const nursery = await Nursery.findByIdAndDelete(id);
    if (!nursery) return res.status(404).json({ status: false, message: "Nursery not found" });

    if (nursery.nursery_image) deleteFile(nursery.nursery_image);

    res.json({ status: true, message: "Nursery deleted successfully" });
});

