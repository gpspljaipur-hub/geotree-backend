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
    // Aggregate by name string ('state') to ensure all unique imported states are shown.
    // Grouping by 'state_id' would collapse all unlinked states into a single null group.
    const states = await LocationData.aggregate([
        {
            $group: {
                _id: "$state",
                state_id: { $max: "$state_id" }
            }
        },
        {
            $project: {
                // Use state_id if available, otherwise fallback to name string for the value
                _id: { $ifNull: ["$state_id", "$_id"] },
                state_name: "$_id"
            }
        },
        { $sort: { state_name: 1 } }
    ]);
    res.json({ status: true, data: states });
});

// @desc    Get districts for a state
export const getDistricts = asyncHandler(async (req, res) => {
    const { state_id, state } = req.query;
    if (!state_id && !state) throw new ApiError(400, "state_id or state is required");

    const filter = state_id ? { state_id } : { state };
    const districts = await LocationData.distinct('district', filter);
    res.json({ status: true, data: districts.sort() });
});

// @desc    Get blocks for a state + district
export const getBlocks = asyncHandler(async (req, res) => {
    const { state_id, state, district } = req.query;
    if (!state_id && !state) throw new ApiError(400, "state_id or state is required");
    if (!district) throw new ApiError(400, "district is required");

    const filter = state_id ? { state_id, district } : { state, district };
    const blocks = await LocationData.distinct('block', filter);
    res.json({ status: true, data: blocks.sort() });
});

// @desc    Get gram panchayats
export const getGPs = asyncHandler(async (req, res) => {
    const { state_id, state, district, block } = req.query;
    if (!state_id && !state) throw new ApiError(400, "state_id or state is required");

    const filter = state_id ? { state_id } : { state };
    if (district) filter.district = district;
    if (block) filter.block = block;

    const gps = await LocationData.distinct('gram_panchayat', filter);
    res.json({ status: true, data: gps.sort() });
});

// @desc    Get villages
export const getVillages = asyncHandler(async (req, res) => {
    const { state_id, state, district, block, gram_panchayat } = req.query;
    if (!state_id && !state) throw new ApiError(400, "state_id or state is required");

    const filter = state_id ? { state_id } : { state };
    if (district) filter.district = district;
    if (block) filter.block = block;
    if (gram_panchayat) filter.gram_panchayat = gram_panchayat;

    const villages = await LocationData.distinct('village', filter);
    res.json({ status: true, data: villages.sort() });
});
