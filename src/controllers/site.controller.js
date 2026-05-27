import mongoose from "mongoose";
import Site from "../models/site.model.js";
import State from "../models/state.model.js";
import LocationData from "../models/locationData.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getCentroid, getArea, parseKML, parseSHP } from "../utils/geo.util.js";
import { translateData } from "../utils/translation.util.js";
import { getRequestParams, parseBoolean } from "../utils/request.util.js";
import { deleteFile } from "../utils/file.util.js";
import fs from 'fs';
import Plantation from "../models/plantation.model.js";
import Species from "../models/species.model.js";


/**
 * Parse a pipe-separated polygon string into a GeoJSON Polygon.
 * Frontend format: "26.903129, 75.774199 | 26.899293, 75.784292 | ..."
 * Each pair is "lat, lng". GeoJSON requires [lng, lat] order.
 * @param {string} polygonStr
 * @returns {Object|null} GeoJSON Polygon or null on failure
 */
function parsePipePolygon(polygonStr) {
    try {
        const points = polygonStr.split('|').map(pair => {
            const [lat, lng] = pair.trim().split(',').map(Number);
            if (isNaN(lat) || isNaN(lng)) throw new Error('Invalid coordinate');
            return [lng, lat]; // GeoJSON: [longitude, latitude]
        });
        if (points.length < 3) return null;
        // Close the ring if not already closed
        const first = points[0], last = points[points.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            points.push([first[0], first[1]]);
        }
        return { type: 'Polygon', coordinates: [points] };
    } catch (e) {
        return null;
    }
}

/**
 * Normalise request body to internal snake_case field names.
 * Accepts both camelCase (from frontend) and snake_case (from Postman/API).
 */
function normaliseSiteBody(body) {
    return {
        site_name: body.site_name,
        state_id: body.state_id,
        district: body.district,
        block: body.block,
        // camelCase alias support
        gram_panchayat: body.gram_panchayat ?? body.gramPanchayat,
        village: body.village,
        plantation_type: body.plantation_type ?? body.plantationType,
        // polygon (pipe-separated) OR boundary (GeoJSON) — polygon takes priority
        polygon: body.polygon,
        boundary: body.boundary,
        // area is always auto-calculated from boundary — ignore frontend value
        capacity: body.capacity,
        // totalTreesPlanted alias for planted_count
        planted_count: body.planted_count ?? body.totalTreesPlanted,
        // treesRemaining is a virtual — ignore from frontend
        native_species: body.native_species ?? body.nativeSpecies,
        site_image: body.site_image,
        status: body.status,
        description: body.description,
        // pagination / misc retained
        lat: body.lat,
        lng: body.lng,
        remaining_trees: body.remaining_trees,
    };
}

// @desc    Get site list
export const getSiteList = asyncHandler(async (req, res) => {
    const { state_id, lang, status, page = 1, limit = 10, sort = 'site_name', search } = getRequestParams(req, ['state_id', 'lang', 'status', 'page', 'limit', 'sort', 'search']);
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

    if (!state_id && !isAdmin) return res.json({ status: true, message: "Please select a state to view sites.", data: [] });

    const filter = {};
    if (state_id) filter.state_id = state_id;
    if (status !== undefined) filter.status = parseBoolean(status);
    else if (!isAdmin) filter.status = true;

    if (search) {
        filter.site_name = { $regex: search, $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;

    const [sites, total] = await Promise.all([
        Site.find(filter)
            .populate('state_id', 'state_name description state_image')
            .populate('native_species', 'name scientific_name')
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
        Site.countDocuments(filter)
    ]);

    let finalData = sites.map(loc => ({
        ...loc,
        state_id: {
            ...loc.state_id,
            state_image: loc.state_id?.state_image || null
        },
        remaining_trees: (loc.capacity && loc.capacity !== -1) ? Math.max(0, loc.capacity - (loc.planted_count || 0)) : "Unlimited"
    }));

    if (lang !== 'en') finalData = await translateData(finalData, ['site_name'], lang);

    res.json({
        status: true,
        message: "Site list fetched",
        data: finalData,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
        }
    });
});

// @desc    Get site details
export const getSiteById = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) return res.status(400).json({ status: false, message: "ID required" });

    const site = await Site.findById(id)
        .populate('state_id', 'state_name description state_image')
        .populate('native_species', 'name scientific_name')
        .lean();

    if (!site) return res.status(404).json({ status: false, message: "Site not found" });

    const data = {
        ...site,
        remaining_trees: (site.capacity && site.capacity !== -1) ? Math.max(0, site.capacity - (site.planted_count || 0)) : "Unlimited"
    };

    res.json({ status: true, message: "Site details fetched", data });
});

// @desc    Add site
export const addSite = asyncHandler(async (req, res) => {
    // Normalise field names — accepts camelCase from frontend & snake_case from API
    let {
        site_name, lat, lng, status, state_id, district, block,
        gram_panchayat, village, plantation_type, capacity,
        remaining_trees, planted_count, polygon, boundary, native_species, site_image, description
    } = normaliseSiteBody(req.body);

    // Parse pipe-polygon string into GeoJSON if provided
    if (polygon && !boundary) {
        boundary = parsePipePolygon(polygon);
        if (!boundary) {
            return res.status(400).json({ status: false, message: "Invalid polygon format. Use: 'lat, lng | lat, lng | ...'" });
        }
    }

    // If remaining_trees is provided, use it as capacity (new site — planted_count starts at 0)
    if (remaining_trees !== undefined && capacity === undefined) {
        capacity = remaining_trees;
    }
    if (!site_name || !state_id || !district) {
        return res.status(400).json({ status: false, message: "Site name, State, and District are required" });
    }

    // Guard: state_id must be a valid ObjectId — reject readable names like "Assam" early
    if (!mongoose.isValidObjectId(state_id)) {
        return res.status(400).json({ status: false, message: "state_id must be a valid MongoDB ObjectId, not a state name" });
    }

    if (typeof boundary === 'string' && boundary.trim() !== '') {
        try { boundary = JSON.parse(boundary); } catch (e) {
            return res.status(400).json({ status: false, message: "Invalid boundary format" });
        }
    }

    const stateDoc = await State.findById(state_id);
    if (!stateDoc) return res.status(400).json({ status: false, message: "State not found for the given ID" });

    // Validate district against LocationData — prefer FK (state_id), fallback to string
    const locFilter = { $or: [{ state_id: stateDoc._id }, { state: stateDoc.state_name }] };
    const hasStateLocData = await LocationData.exists(locFilter);
    const districtExists = hasStateLocData
        ? await LocationData.exists({ ...locFilter, district })
        : false;

    if (hasStateLocData && !districtExists) {
        return res.status(400).json({
            status: false,
            message: `District '${district}' is not valid for state '${stateDoc.state_name}'`
        });
    }

    // Auto-register new Block / GP / Village into LocationData if admin provides new values
    if (districtExists && (block || gram_panchayat || village)) {
        const newLocEntry = { state_id: stateDoc._id, state: stateDoc.state_name, district };
        if (block) newLocEntry.block = block;
        if (gram_panchayat) newLocEntry.gram_panchayat = gram_panchayat;
        if (village) newLocEntry.village = village;

        // Use updateOne + upsert to avoid duplicate entries
        await LocationData.updateOne(
            { state_id: stateDoc._id, district, block: block || null },
            { $set: newLocEntry },
            { upsert: true }
        );
        console.log(`[LocationData] Auto-registered: ${JSON.stringify(newLocEntry)}`);
    }

    // Parse native_species: accept array of ObjectIds or comma-string
    let parsedNativeSpecies = native_species;
    if (typeof native_species === 'string' && native_species.trim().startsWith('[')) {
        try { parsedNativeSpecies = JSON.parse(native_species); } catch (e) { parsedNativeSpecies = []; }
    }
    if (typeof parsedNativeSpecies === 'string') {
        // Comma-separated string → array
        parsedNativeSpecies = parsedNativeSpecies.split(',').map(s => s.trim()).filter(Boolean);
    }

    const data = {
        site_name,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
        boundary: boundary || undefined,
        status: status !== undefined ? parseBoolean(status) : true,
        state_id,
        district,
        block,
        gram_panchayat,
        village,
        plantation_type,
        capacity: capacity !== undefined ? Number(capacity) : -1,
        planted_count: planted_count !== undefined ? Number(planted_count) : 0,
        native_species: parsedNativeSpecies || [],
        site_image: req.file ? `/uploads/site/${req.file.filename}` : (site_image || undefined),
        description
        // NOTE: 'area' is NOT set here — auto-calculated by pre-save hook from boundary
        // NOTE: 'treesRemaining' is a virtual — never written to DB
    };

    const site = await Site.create(data);
    res.status(201).json({ status: true, message: "Site added", data: site });
});

// @desc    Update site
export const updateSite = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) return res.status(400).json({ status: false, message: "ID required" });

    // Normalise field names — accepts camelCase from frontend & snake_case from API
    let {
        site_name, lat, lng, status, state_id, district, block,
        gram_panchayat, village, plantation_type, capacity,
        remaining_trees, planted_count, polygon, boundary, native_species, site_image, description
    } = normaliseSiteBody(req.body);

    // Parse pipe-polygon string into GeoJSON if provided
    if (polygon && !boundary) {
        boundary = parsePipePolygon(polygon);
        if (!boundary) {
            return res.status(400).json({ status: false, message: "Invalid polygon format. Use: 'lat, lng | lat, lng | ...'" });
        }
    }

    let updateData = {};
    if (site_name) updateData.site_name = site_name;

    if (state_id) {
        // Guard: reject state names passed as state_id
        if (!mongoose.isValidObjectId(state_id)) {
            return res.status(400).json({ status: false, message: "state_id must be a valid MongoDB ObjectId, not a state name" });
        }
        updateData.state_id = state_id;
    }

    if (district) updateData.district = district;
    if (block !== undefined) updateData.block = block;
    if (gram_panchayat !== undefined) updateData.gram_panchayat = gram_panchayat;
    if (village !== undefined) updateData.village = village;
    if (plantation_type !== undefined) updateData.plantation_type = plantation_type;

    if (req.file) {
        const currentSite = await Site.findById(id).select('site_image');
        if (currentSite?.site_image) deleteFile(currentSite.site_image);
        updateData.site_image = `/uploads/site/${req.file.filename}`;
    } else if (site_image !== undefined) {
        if (!site_image || site_image.trim() === '') {
            const currentSite = await Site.findById(id).select('site_image');
            if (currentSite?.site_image) deleteFile(currentSite.site_image);
        }
        updateData.site_image = site_image;
    }

    if (description !== undefined) updateData.description = description;

    // Parse native_species: accept array of ObjectIds or comma-string or JSON-stringified array
    if (native_species !== undefined) {
        let parsedNS = native_species;
        if (typeof native_species === 'string' && native_species.trim().startsWith('[')) {
            try { parsedNS = JSON.parse(native_species); } catch (e) { parsedNS = []; }
        }
        if (typeof parsedNS === 'string') {
            parsedNS = parsedNS.split(',').map(s => s.trim()).filter(Boolean);
        }
        updateData.native_species = parsedNS;
    }

    // Allow admin to manually adjust planted_count (e.g. corrections, imports)
    if (planted_count !== undefined) updateData.planted_count = Number(planted_count);

    if (remaining_trees !== undefined && capacity === undefined) {
        updateData.capacity = Number(remaining_trees);
    } else if (capacity !== undefined) {
        updateData.capacity = Number(capacity);
    }

    if (boundary) {
        let parsedBoundary = boundary;
        if (typeof boundary === 'string' && boundary.trim() !== '') {
            try { parsedBoundary = JSON.parse(boundary); } catch (e) { }
        }
        updateData.boundary = parsedBoundary;

        // If boundary is updated, also update lat/lng (centroid) and area
        const centroid = getCentroid(parsedBoundary);
        if (centroid) {
            updateData.lat = centroid.lat;
            updateData.lng = centroid.lng;
        }
        updateData.area = getArea(parsedBoundary) / 10000;
    }

    if (lat) updateData.lat = Number(lat);
    if (lng) updateData.lng = Number(lng);
    if (status !== undefined) updateData.status = parseBoolean(status);

    // Validate & auto-register new location values if location fields are being updated
    if (updateData.state_id || updateData.district || updateData.block || updateData.gram_panchayat || updateData.village) {
        const currentSite = await Site.findById(id).select('state_id district block gram_panchayat village');
        const targetStateId = updateData.state_id || currentSite.state_id;
        const targetDistrict = updateData.district || currentSite.district;
        const targetBlock = updateData.block !== undefined ? updateData.block : currentSite.block;
        const targetGP = updateData.gram_panchayat !== undefined ? updateData.gram_panchayat : currentSite.gram_panchayat;
        const targetVillage = updateData.village !== undefined ? updateData.village : currentSite.village;

        const stateRepo = await State.findById(targetStateId);
        if (stateRepo) {
            // Validate district — prefer FK (state_id), fallback to string
            const locFilter = { $or: [{ state_id: stateRepo._id }, { state: stateRepo.state_name }] };
            const hasLocData = await LocationData.exists(locFilter);
            const districtValid = hasLocData
                ? await LocationData.exists({ ...locFilter, district: targetDistrict })
                : false;

            if (hasLocData && !districtValid) {
                return res.status(400).json({ status: false, message: `District '${targetDistrict}' is not valid for state '${stateRepo.state_name}'` });
            }

            // Auto-register new Block / GP / Village
            if (districtValid && (targetBlock || targetGP || targetVillage)) {
                const newLocEntry = { state_id: stateRepo._id, state: stateRepo.state_name, district: targetDistrict };
                if (targetBlock) newLocEntry.block = targetBlock;
                if (targetGP) newLocEntry.gram_panchayat = targetGP;
                if (targetVillage) newLocEntry.village = targetVillage;

                await LocationData.updateOne(
                    { state_id: stateRepo._id, district: targetDistrict, block: targetBlock || null },
                    { $set: newLocEntry },
                    { upsert: true }
                );
                console.log(`[LocationData] Auto-registered on update: ${JSON.stringify(newLocEntry)}`);
            }
        }
    }

    const site = await Site.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!site) return res.status(404).json({ status: false, message: "Site not found" });

    res.json({ status: true, message: "Site updated", data: site });
});

// @desc    Delete site
export const deleteSite = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) return res.status(400).json({ status: false, message: "ID required" });

    const deleted = await Site.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ status: false, message: "Site not found" });

    if (deleted.site_image) {
        deleteFile(deleted.site_image);
    }

    res.json({ status: true, message: "Site deleted" });
});

// @desc    Upload KML/SHP file and return GeoJSON boundary
export const uploadBoundaryFile = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ status: false, message: "No file uploaded" });

    try {
        const filePath = req.file.path;
        const buffer = fs.readFileSync(filePath);
        const extension = req.file.originalname.split('.').pop().toLowerCase();

        let boundary;
        if (extension === 'kml') {
            boundary = parseKML(buffer);
        } else if (extension === 'zip') {
            boundary = await parseSHP(buffer);
        } else {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(400).json({ status: false, message: "Unsupported format. Use .kml or .zip (for Shapefiles)." });
        }

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        const centroid = getCentroid(boundary);

        res.json({
            status: true,
            message: "File parsed successfully",
            data: { boundary, centroid }
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ status: false, message: error.message });
    }
});

///
export const getSiteAllList = asyncHandler(async (req, res) => {
    const { state_id, lang, status, page = 1, limit = 10, sort = 'site_name', search } = getRequestParams(req, ['state_id', 'lang', 'status', 'page', 'limit', 'sort', 'search']);
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';


    const filter = {};
    if (state_id) filter.state_id = state_id;
    if (status !== undefined) filter.status = parseBoolean(status);
    else if (!isAdmin) filter.status = true;

    if (search) {
        filter.site_name = { $regex: search, $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;

    const [sites, total] = await Promise.all([
        Site.find(filter)
            .populate('state_id', 'state_name description state_image')
            .populate('native_species', 'name scientific_name')
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
        Site.countDocuments(filter)
    ]);

    let finalData = sites.map(loc => ({
        ...loc,
        state_id: {
            ...loc.state_id,
            state_image: loc.state_id?.state_image || null
        },
        remaining_trees: (loc.capacity && loc.capacity !== -1) ? Math.max(0, loc.capacity - (loc.planted_count || 0)) : "Unlimited"
    }));

    if (lang !== 'en') finalData = await translateData(finalData, ['site_name'], lang);

    res.json({
        status: true,
        message: "Site list fetched",
        data: finalData,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
        }
    });
});

// @desc    Get species summary for App
export const getAppSpeciesSummary = asyncHandler(async (req, res) => {
    const { state_id, lang = 'en' } = getRequestParams(req, ['state_id', 'lang']);

    // Match filter for plantations
    const match = { payment_status: 'Completed', site_id: { $ne: null } };
    if (state_id && mongoose.isValidObjectId(state_id)) {
        match.state_id = new mongoose.Types.ObjectId(state_id);
    }

    // Phase 1: Aggregate planting statistics grouped by species and site
    const stats = await Plantation.aggregate([
        { $match: match },
        { $unwind: '$plants' },
        {
            $group: {
                _id: {
                    species_id: '$plants.plant_id',
                    site_id: '$site_id'
                },
                count: { $sum: '$plants.quantity' }
            }
        },
        {
            $group: {
                _id: '$_id.species_id',
                total_planted: { $sum: '$count' },
                plantations: {
                    $push: {
                        site_id: '$_id.site_id',
                        count: '$count'
                    }
                }
            }
        }
    ]);

    if (stats.length === 0) {
        return res.json({ status: true, message: "No species summary found", data: [] });
    }

    const speciesIds = stats.map(s => s._id).filter(id => id && mongoose.isValidObjectId(id));

    // Phase 2: Fetch Species details and available Sites in parallel
    const [speciesList, allSites] = await Promise.all([
        Species.find({ _id: { $in: speciesIds } }).lean(),
        Site.find({ native_species: { $in: speciesIds }, status: true })
            .populate("state_id", "state_name")
            .select("site_name state_id native_species capacity planted_count")
            .lean()
    ]);

    // Phase 3: Map data for efficient lookup
    const statsMap = new Map(stats.map(s => [s._id.toString(), s]));
    
    const speciesToSitesMap = {};
    allSites.forEach(site => {
        const siteDetails = {
            site_id: site._id,
            site_name: site.site_name,
            state_id: site.state_id?._id || null,
            state_name: site.state_id?.state_name || "N/A",
            remaining_capacity: (site.capacity && site.capacity !== -1) ? Math.max(0, site.capacity - (site.planted_count || 0)) : "Unlimited"
        };
        
        (site.native_species || []).forEach(specId => {
            const idStr = specId.toString();
            if (!speciesToSitesMap[idStr]) speciesToSitesMap[idStr] = [];
            speciesToSitesMap[idStr].push(siteDetails);
        });
    });

    // Phase 4: Assemble final data
    let finalData = speciesList.map(sp => {
        const idStr = sp._id.toString();
        const spStats = statsMap.get(idStr) || { total_planted: 0, plantations: [] };
        
        // Enrich available locations with "planted_here" count if applicable
        const plantationCountsBySite = new Map(spStats.plantations.map(p => [p.site_id.toString(), p.count]));
        
        const availableLocations = (speciesToSitesMap[idStr] || []).map(loc => ({
            ...loc,
            planted_here: plantationCountsBySite.get(loc.site_id.toString()) || 0
        }));

        return {
            species_id: sp._id,
            species_name: sp.name,
            scientific_name: sp.scientific_name,
            species_image: sp.species_image,
            description: sp.description,
            co2_absorption: sp.co2_absorption,
            maturity_period: sp.maturity_period,
            variations: sp.variations || [],
            total_planted: spStats.total_planted,
            available_locations: availableLocations
        };
    });

    // Sort by name
    finalData.sort((a, b) => a.species_name.localeCompare(b.species_name));

    // Phase 5: Bulk Translation
    if (lang !== 'en') {
        // Translate species-level fields
        finalData = await translateData(finalData, ['species_name', 'description'], lang);
        
        // Flatten all locations across all species for bulk translation to save time/cost
        const allLocations = finalData.flatMap(item => item.available_locations);
        if (allLocations.length > 0) {
            // translateData modifies in place or returns new array depending on implementation
            // our implementation returns a new array/object but we can handle it
            const translatedLocs = await translateData(allLocations, ['site_name', 'state_name'], lang);
            
            // Re-assign translated locations back to finalData
            let offset = 0;
            finalData.forEach(item => {
                const count = item.available_locations.length;
                item.available_locations = translatedLocs.slice(offset, offset + count);
                offset += count;
            });
        }
    }

    res.json({
        status: true,
        message: "App species summary fetched",
        data: finalData
    });
});
