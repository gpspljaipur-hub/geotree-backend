import Species from '../models/species.model.js';
import Site from '../models/site.model.js';
import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import { translateData } from "../utils/translation.util.js";
import { getRequestParams, parseBoolean } from "../utils/request.util.js";
import { deleteFile } from "../utils/file.util.js";

/**
 * Fallback parser for sloppy/invalid JSON strings in variations like `[{height: 5 fit,price: 100}]`
 */
function parseSloppyJsonArray(str) {
    if (!str) return [];
    const results = [];
    const blockRegex = /\{([^{}]+)\}/g;
    let match;
    while ((match = blockRegex.exec(str)) !== null) {
        const blockContent = match[1];
        
        let height = "";
        const heightMatch = blockContent.match(/height\s*:\s*([^,{}]+)/i);
        if (heightMatch) {
            height = heightMatch[1].replace(/['"]/g, '').trim();
        }
        
        let priceVal = 0;
        const priceMatch = blockContent.match(/(?:price|rate)\s*:\s*([^,{}]+)/i);
        if (priceMatch) {
            priceVal = Number(priceMatch[1].replace(/['"]/g, '').trim()) || 0;
        }
        
        results.push({ height, price: priceVal });
    }
    return results;
}

/**
 * Normalise request body to internal snake_case field names.
 * Accepts both camelCase (from frontend) and snake_case (from Postman/API).
 */
function normaliseSpeciesBody(body) {
    let {
        name,
        scientific_name, scientificName,
        description,
        variations,
        heightPriceList,
        height,
        price,
        rate,
        status,
        co2_absorption, sequestration,
        maturity_period, maturityPeriod,
        image, species_image,
        state_id, stateId,
        site_id, siteId, project_id, projectId
    } = body;

    let parsedVariations = variations || heightPriceList;
    if (parsedVariations !== undefined) {
        if (typeof parsedVariations === 'string') {
            try {
                parsedVariations = JSON.parse(parsedVariations);
            } catch (e) {
                // Fallback parser if JSON.parse fails (e.g. key/value lack quotes)
                parsedVariations = parseSloppyJsonArray(parsedVariations);
            }
        }
        if (Array.isArray(parsedVariations)) {
            parsedVariations = parsedVariations.map(v => ({
                height: v.height !== undefined ? String(v.height).trim() : "",
                price: Number(v.price ?? v.rate ?? 0)
            }));
        }
    } else if (height !== undefined || price !== undefined || rate !== undefined) {
        parsedVariations = [{
            height: height !== undefined ? String(height).trim() : "",
            price: Number(price ?? rate ?? 0)
        }];
    }

    const data = {};
    if (name) data.name = name;

    const finalScientific = scientific_name ?? scientificName;
    if (finalScientific !== undefined) data.scientific_name = finalScientific;

    if (description !== undefined) data.description = description;

    // Consolidate redundant location IDs
    data.state_id = state_id || stateId;
    data.site_id = site_id || siteId || project_id || projectId;

    if (parsedVariations !== undefined) data.variations = parsedVariations;
    if (status !== undefined) data.status = parseBoolean(status);

    const finalCo2 = co2_absorption ?? sequestration;
    if (finalCo2 !== undefined && finalCo2 !== "") data.co2_absorption = Number(finalCo2);

    const finalMaturity = maturity_period ?? maturityPeriod;
    if (finalMaturity !== undefined) data.maturity_period = finalMaturity;

    const explicitImageDeletion = (species_image === "" || species_image === "null" || species_image === null || image === "" || image === "null" || image === null);

    return { data, explicitImageDeletion };
}

// @desc    Get all species with filtering and searching
export const getAll = asyncHandler(async (req, res) => {
    const params = getRequestParams(req, ['state_id', 'site_id', 'project_id', 'location_id', 'search', 'status', 'lang', 'page', 'limit', 'sort']);
    const site_id = params.site_id || params.project_id || params.location_id;
    const { state_id, search, status, lang, page = 1, limit = 10, sort = 'created_at' } = params;

    const conditions = [];

    if (state_id) conditions.push({ state_id });

    if (site_id) {
        // Find the site to get its native_species list
        const site = await Site.findById(site_id).select('native_species');
        const nativeSpecies = site?.native_species;

        const orConditions = [{ site_id: site_id }];

        if (typeof nativeSpecies === 'string' && nativeSpecies.trim() !== '') {
            const speciesNames = nativeSpecies.split(',').map(s => s.trim());
            orConditions.push({ name: { $in: speciesNames } });
        } else if (Array.isArray(nativeSpecies)) {
            orConditions.push({ _id: { $in: nativeSpecies } });
        }

        conditions.push({ $or: orConditions });
    }

    if (status !== undefined) {
        conditions.push({ status: parseBoolean(status) });
    }

    if (search) {
        conditions.push({
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { scientific_name: { $regex: search, $options: 'i' } }
            ]
        });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};

    const skip = (Number(page) - 1) * Number(limit);
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;

    const [species, total] = await Promise.all([
        Species.find(query)
            .select('-site_image -source -__v')
            .populate('state_id', 'state_name state_image')
            .populate('site_id', 'site_name')
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
        Species.countDocuments(query)
    ]);

    let finalData = species;

    if (lang !== 'en') {
        finalData = await translateData(finalData, ['name', 'description'], lang);
    }

    res.status(200).json({
        status: true,
        message: "Species list fetched successfully",
        data: finalData,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
        }
    });
});

// @desc    Get species by ID
export const getById = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) return res.status(400).json({ status: false, message: "ID is required" });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ status: false, message: "Invalid Species ID format" });

    const species = await Species.findById(id)
        .select('-site_image -source -__v')
        .populate('state_id')
        .populate('site_id');

    if (!species) {
        return res.status(404).json({ status: false, message: 'Species not found' });
    }

    const formatted = species.toObject();

    res.status(200).json({
        status: true,
        message: "Species details fetched successfully",
        data: formatted
    });
});

// @desc    Create new species
export const create = asyncHandler(async (req, res) => {
    console.log('===>>>', req.body)
    const { data } = normaliseSpeciesBody(req.body);

    // Provide creation fallbacks
    if (data.status === undefined) data.status = true;

    if (req.file) {
        data.species_image = `/uploads/species/${req.file.filename}`;
    }

    const species = await Species.create(data);

    // Optimize: populate the created document instead of doing another database query
    await species.populate([
        { path: 'state_id', select: 'state_name state_image' },
        { path: 'site_id', select: 'site_name' }
    ]);

    const responseData = species.toObject({ versionKey: false });
    delete responseData.site_image;
    delete responseData.source;

    res.status(201).json({ status: true, message: "Species created successfully", data: responseData });
});

// @desc    Update existing species
export const update = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) return res.status(400).json({ status: false, message: "ID is required" });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ status: false, message: "Invalid Species ID format" });

    const species = await Species.findById(id);
    if (!species) return res.status(404).json({ status: false, message: 'Species not found' });

    const { data, explicitImageDeletion } = normaliseSpeciesBody(req.body);

    if (!req.file && explicitImageDeletion) {
        return res.status(400).json({ status: false, message: "species_image is required" });
    }

    if (req.file) {
        data.species_image = `/uploads/species/${req.file.filename}`;
    }

    const updatedSpecies = await Species.findByIdAndUpdate(id, data, { new: true, runValidators: true })
        .select('-site_image -source -__v')
        .populate('state_id')
        .populate('site_id')
        .lean();

    // Delete the old file only AFTER successful DB update to prevent accidental data loss in case validation fails
    if (req.file && species.species_image) {
        deleteFile(species.species_image);
    }

    const responseData = updatedSpecies;

    res.status(200).json({ status: true, message: "Species updated successfully", data: responseData });
});

// @desc    Delete species
export const remove = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) return res.status(400).json({ status: false, message: "ID is required" });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ status: false, message: "Invalid Species ID format" });

    const species = await Species.findByIdAndDelete(id);
    if (!species) return res.status(404).json({ status: false, message: 'Species not found' });

    if (species.species_image) deleteFile(species.species_image);

    res.status(200).json({ status: true, message: 'Species deleted successfully' });
});
