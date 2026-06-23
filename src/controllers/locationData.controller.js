import LocationData from "../models/locationData.model.js";
import State from "../models/state.model.js";
import XLSX from 'xlsx';
import fs from 'fs';
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

// @desc    Upload Excel to populate location hierarchy
//          Resolves each state name → State._id FK automatically
export const uploadLocationExcel = asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "Please upload an excel file");

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!data.length) {
        fs.unlinkSync(req.file.path);
        throw new ApiError(400, "Excel file is empty");
    }

    // --- Collect all unique state names from the sheet ---
    const uniqueStateNames = [...new Set(
        data
            .map(row => (row.State || row.state || "").trim())
            .filter(Boolean)
    )];

    // --- Batch-fetch matching State documents ---
    const stateDocs = await State.find(
        { state_name: { $in: uniqueStateNames } },
        '_id state_name'
    ).lean();

    const stateNameToId = {};
    for (const s of stateDocs) {
        stateNameToId[s.state_name] = s._id;
    }

    // --- Clean existing data and re-insert ---
    await LocationData.deleteMany({});

    const bulkData = data.map(row => {
        const stateName = (row.State || row.state || "").trim();
        const district = (row.District || row.district || "").trim();

        if (!stateName || !district) return null;

        const item = {
            state: stateName,
            district: district,
            // FK — may be undefined if the state doesn't exist in the State collection yet
            state_id: stateNameToId[stateName] || undefined
        };

        const block = row.Block || row.block || row.SubDistrict || row['Sub-district'];
        const gp = row['Gram Panchayat'] || row.gram_panchayat || row.GP || row.gp;
        const village = row.Village || row.village;

        if (block) item.block = block;
        if (gp) item.gram_panchayat = gp;
        if (village) item.village = village;

        return item;
    }).filter(Boolean);

    await LocationData.insertMany(bulkData);

    // Cleanup uploaded file
    fs.unlinkSync(req.file.path);

    const linkedCount = bulkData.filter(r => r.state_id).length;
    const unlinkedCount = bulkData.length - linkedCount;

    res.status(201).json({
        status: true,
        message: `Successfully uploaded ${bulkData.length} location records (${linkedCount} linked to State, ${unlinkedCount} unlinked — create matching States if needed)`
    });
});

// ─── Cascade dropdown helpers ──────────────────────────────────────────────
// All endpoints accept EITHER `state_id` (FK, preferred) OR `state` (legacy string)

// @desc    Get unique states (from LocationData — reflects what was imported)
export const getStates = asyncHandler(async (req, res) => {
    // Check nested structure first (imported JSON file)
    const nestedDoc = await LocationData.findOne({ states: { $exists: true } }).lean();
    let states = [];
    if (nestedDoc && nestedDoc.states && nestedDoc.states.length > 0) {
        states = nestedDoc.states.map(s => s.state || s.state_name).filter(Boolean);
    } else {
        // Flat structure
        states = await LocationData.distinct('state');
    }

    if (!states || states.length === 0) {
        // Fallback to State collection if locationData has not been imported yet
        const stateDocs = await State.find({ status: true }).select('state_name').lean();
        states = stateDocs.map(s => s.state_name).filter(Boolean);
    }

    const formattedStates = states.sort().map(state => ({
        _id: state,
        state_name: state
    }));
    res.json({ status: true, data: formattedStates });
});

// @desc    Get districts for a state
export const getDistricts = asyncHandler(async (req, res) => {
    const { state } = req.body;
    if (!state) throw new ApiError(400, "state is required");
    const trimmedState = state.trim();

    // Check nested structure first
    const nestedDoc = await LocationData.findOne({ states: { $exists: true } }).lean();
    let districts = [];
    if (nestedDoc && nestedDoc.states) {
        const stateMatch = nestedDoc.states.find(s =>
            (s.state || s.state_name || "").trim().toLowerCase() === trimmedState.toLowerCase()
        );
        if (stateMatch && stateMatch.districts) {
            districts = stateMatch.districts.map(d => typeof d === 'string' ? d : (d.district || d.district_name || d));
        }
    } else {
        // Flat structure
        districts = await LocationData.distinct('district', { state: trimmedState });
    }

    const formattedDistricts = districts.sort().map(district => ({
        _id: district,
        district_name: district
    }));
    res.json({ status: true, data: formattedDistricts });
});

// @desc    Get blocks for a state + district
export const getBlocks = asyncHandler(async (req, res) => {
    const { state, district } = req.body;
    if (!state) throw new ApiError(400, "state is required");
    if (!district) throw new ApiError(400, "district is required");

    const trimmedState = state.trim();
    const trimmedDistrict = district.trim();

    // Check nested structure first
    const nestedDoc = await LocationData.findOne({ states: { $exists: true } }).lean();
    let blocks = [];
    if (nestedDoc && nestedDoc.states) {
        const stateMatch = nestedDoc.states.find(s =>
            (s.state || s.state_name || "").trim().toLowerCase() === trimmedState.toLowerCase()
        );
        if (stateMatch && stateMatch.districts) {
            const distMatch = stateMatch.districts.find(d =>
                (typeof d === 'string' ? d : (d.district || d.district_name || d)).trim().toLowerCase() === trimmedDistrict.toLowerCase()
            );
            if (distMatch && distMatch.blocks) {
                blocks = distMatch.blocks.map(b => typeof b === 'string' ? b : (b.block || b.block_name || b));
            }
        }
    } else {
        // Flat structure
        blocks = await LocationData.distinct('block', { state: trimmedState, district: trimmedDistrict });
    }

    res.json({ status: true, data: blocks.sort() });
});

// @desc    Get gram panchayats
export const getGPs = asyncHandler(async (req, res) => {
    const { state, district, block } = req.body;
    if (!state) throw new ApiError(400, "state is required");
    const trimmedState = state.trim();
    const trimmedDistrict = district ? district.trim() : null;
    const trimmedBlock = block ? block.trim() : null;

    const nestedDoc = await LocationData.findOne({ states: { $exists: true } }).lean();
    let gps = [];
    if (nestedDoc && nestedDoc.states) {
        const stateMatch = nestedDoc.states.find(s =>
            (s.state || s.state_name || "").trim().toLowerCase() === trimmedState.toLowerCase()
        );
        if (stateMatch && stateMatch.districts && trimmedDistrict) {
            const distMatch = stateMatch.districts.find(d =>
                (typeof d === 'string' ? d : (d.district || d.district_name || d)).trim().toLowerCase() === trimmedDistrict.toLowerCase()
            );
            if (distMatch && distMatch.blocks && trimmedBlock) {
                const blockMatch = distMatch.blocks.find(b =>
                    (typeof b === 'string' ? b : (b.block || b.block_name || b)).trim().toLowerCase() === trimmedBlock.toLowerCase()
                );
                if (blockMatch && blockMatch.gram_panchayats) {
                    gps = blockMatch.gram_panchayats;
                }
            }
        }
    } else {
        // Flat structure
        const filter = { state: trimmedState };
        if (trimmedDistrict) filter.district = trimmedDistrict;
        if (trimmedBlock) filter.block = trimmedBlock;
        gps = await LocationData.distinct('gram_panchayat', filter);
    }

    res.json({ status: true, data: gps.sort() });
});

// @desc    Get villages
export const getVillages = asyncHandler(async (req, res) => {
    const { state, district, block, gram_panchayat } = req.body;
    if (!state) throw new ApiError(400, "state is required");

    const trimmedState = state.trim();
    const trimmedDistrict = district ? district.trim() : null;
    const trimmedBlock = block ? block.trim() : null;
    const trimmedGP = gram_panchayat ? gram_panchayat.trim() : null;

    // Check nested structure first
    const nestedDoc = await LocationData.findOne({ states: { $exists: true } }).lean();
    let villages = [];
    if (nestedDoc && nestedDoc.states) {
        const stateMatch = nestedDoc.states.find(s =>
            (s.state || s.state_name || "").trim().toLowerCase() === trimmedState.toLowerCase()
        );
        if (stateMatch && stateMatch.districts && trimmedDistrict) {
            const distMatch = stateMatch.districts.find(d =>
                (typeof d === 'string' ? d : (d.district || d.district_name || d)).trim().toLowerCase() === trimmedDistrict.toLowerCase()
            );
            if (distMatch && distMatch.blocks && trimmedBlock) {
                const blockMatch = distMatch.blocks.find(b =>
                    (typeof b === 'string' ? b : (b.block || b.block_name || b)).trim().toLowerCase() === trimmedBlock.toLowerCase()
                );
                if (blockMatch && blockMatch.gram_panchayats && trimmedGP) {
                    const gpMatch = blockMatch.gram_panchayats.find(gp =>
                        (typeof gp === 'string' ? gp : (gp.gram_panchayat || gp.gp_name || gp)).trim().toLowerCase() === trimmedGP.toLowerCase()
                    );
                    if (gpMatch && gpMatch.villages) {
                        villages = gpMatch.villages;
                    }
                }
            }
        }
    } else {
        // Flat structure
        const filter = { state: trimmedState };
        if (trimmedDistrict) filter.district = trimmedDistrict;
        if (trimmedBlock) filter.block = trimmedBlock;
        if (trimmedGP) filter.gram_panchayat = trimmedGP;
        villages = await LocationData.distinct('village', filter);
    }

    res.json({ status: true, data: villages.sort() });
});
