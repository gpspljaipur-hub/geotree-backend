// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                    PLANTATION CONTROLLER                                ║
// ║  Handles all plantation submission, listing, and management APIs        ║
// ╠═══════════════════════════════════════════════════════════════════════════╣
// ║  EXPORTED APIs (12 total):                                              ║
// ║                                                                         ║
// ║  SECTION 1: INTERNAL EXPORT                                             ║
// ║    • completePlantationRecord  — Used by payment.controller.js          ║
// ║                                                                         ║
// ║  SECTION 2: PLANT LIST                                                  ║
// ║    • getPlantList              — GET/POST /plants/list                  ║
// ║                                                                         ║
// ║  SECTION 3: SUBMIT ENDPOINTS (5 APIs)                                   ║
// ║    • submitOccasionPlantation       — POST /plantations/submit/occasion ║
// ║    • submitIplTeamSupportPlantation — POST /plantations/submit/ipl-team ║
// ║    • submitIplMatchSupportPlantation— POST /plantations/submit/ipl-match║
// ║    • submitCarbonOffsetPlantation   — POST /plantations/submit/carbon   ║
// ║    • submitPlantation               — POST /plantations/add (generic)  ║
// ║                                                                         ║
// ║  SECTION 4: LIST ENDPOINTS (5 APIs)                                     ║
// ║    • getOccasionPlantations         — POST /plantations/list/occasion   ║
// ║    • getIplTeamSupportPlantations   — POST /plantations/list/ipl-team   ║
// ║    • getIplMatchSupportPlantations  — POST /plantations/list/ipl-match  ║
// ║    • getCarbonOffsetPlantations     — POST /plantations/list/carbon     ║
// ║    • getAllPlantations              — POST /plantations/list            ║
// ║                                                                         ║
// ║  SECTION 5: USER HISTORY + ADMIN MUTATIONS (3 APIs)                     ║
// ║    • getPlantationHistory      — POST /plantations/history              ║
// ║    • updatePlantation          — PUT  /plantations/update               ║
// ║    • deletePlantation          — DELETE /plantations/delete             ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import mongoose from "mongoose";
import Plantation from "../models/plantation.model.js";
import Species from "../models/species.model.js";
import Site from "../models/site.model.js";
import Order from "../models/order.model.js";
import OccasionType from "../models/occasionType.model.js";
import Match from "../models/match.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { translateData } from "../utils/translation.util.js";
import ApiError from "../utils/ApiError.js";
import { executeSupportInternal } from "../utils/iplSupport.util.js";
import Certificate from "../models/certificate.model.js";
import SiteInventory from "../models/siteInventory.model.js";
import Team from "../models/team.model.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const CO2_KG_PER_TREE = 20;

// Minimal select used in every list projection (keeps payload small)
const LIST_SELECT = '_id user_id name date trees_count planted_count plantation_status amount payment_status source site_name state_name occasion_id carbon_id tournament_id ipl_support plants occasion_data createdAt';
const DETAIL_SELECT = '-__v'; // include occasion_data in detailed responses

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  PRIVATE HELPERS (not exported — used internally by all handlers)          │
// │  isAdminUser, resolveUserId, syncToSiteInventory, parsePlants,            │
// │  safeParseJSON, enrichPlants, validateOccasionFields, resolveSite,        │
// │  normalisePlantsInput, extractOccasionData                                │
// └─────────────────────────────────────────────────────────────────────────────┘

/** Unified admin check — used by all handlers to avoid inconsistency */
const isAdminUser = (user) => {
  if (!user) return false;
  return user.type === 'admin' || user.role === 'admin' || user.role === 'super_admin';
};

/** Resolve authenticated user_id (admin can impersonate, regular users cannot) */
const resolveUserId = (req) => {
  const isAdmin = isAdminUser(req.user);
  const userId = (isAdmin && req.body.user_id) ? req.body.user_id : req.user?.id;
  if (!userId) throw new ApiError(400, "user_id is required or token missing");
  return userId;
};

/** Sync plantation plants to SiteInventory (Update ordered_count) */
const syncToSiteInventory = async (siteId, plants) => {
  if (!siteId || !plants || !plants.length) return;

  try {
    const ops = plants.map(p => ({
      updateOne: {
        filter: {
          site_id: siteId,
          species_id: p.plant_id,
          tree_height: p.tree_height || ""
        },
        update: { $inc: { ordered_count: Number(p.quantity) || 0 } },
        upsert: true
      }
    }));

    if (ops.length > 0) {
      await SiteInventory.bulkWrite(ops);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Inventory Sync] Updated ${ops.length} species for site ${siteId}`);
      }
    }
  } catch (err) {
    console.error(`[Inventory Sync] Failed for site ${siteId}:`, err.message);
  }
};

/** Parse plants from JSON string or array */
const parsePlants = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); }
  catch (e) {
    if (e instanceof SyntaxError) {
      throw new ApiError(400, "Invalid plants format – expected a JSON array");
    }
    throw e; // Re-throw non-syntax errors
  }
};

/** Parse JSON safely — returns fallback on error */
const safeParseJSON = (raw, fallback = {}) => {
  if (!raw) return fallback;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); }
  catch { return fallback; }
};

/** Enrich plants with species data; compute totals */
const enrichPlants = async (plantsArray) => {
  if (!plantsArray.length) return { enriched: [], totalTrees: 0, totalAmount: 0 };

  const ids = [...new Set(plantsArray.map(p => String(p.plant_id || p.species_id || "")).filter(Boolean))];
  if (!ids.length) throw new ApiError(400, "Each plant entry must include a plant_id or species_id");

  const speciesDocs = await Species.find({ _id: { $in: ids } })
    .select('name variations')
    .lean();

  const speciesMap = new Map(speciesDocs.map(s => [s._id.toString(), s]));

  let totalTrees = 0;
  let totalAmount = 0;

  const enriched = plantsArray.map(p => {
    const spId = String(p.plant_id || p.species_id || "");
    const sp = speciesMap.get(spId);
    if (!sp) throw new ApiError(404, `Species not found: ${spId}`);

    const inputHeight = String(p.tree_height || p.height || "").trim();
    const qty = Math.max(1, Number(p.quantity || p.trees_count || p.count) || 1);

    // Try to find exact match for height (trimmed string comparison)
    let matched = (sp.variations || []).find(v => String(v.height || "").trim() === inputHeight);

    // If height specified but no match found, or if no height specified, fallback to first variation
    if (!matched && (sp.variations || []).length > 0) {
      matched = sp.variations[0];
    }

    const m = matched || {};
    const price = Number(m.price) || 0;
    const height = m.height || "";

    totalTrees += qty;
    totalAmount += qty * price;

    return { 
      plant_id: sp._id, 
      plant_name: sp.name, 
      quantity: qty, 
      price, 
      tree_height: height 
    };
  });

  return { enriched, totalTrees, totalAmount };
};

/** Validate dynamic occasion fields against OccasionType schema */
const validateOccasionFields = async (occasionId, occasionData) => {
  if (!occasionId) return;
  const ot = await OccasionType.findById(occasionId).select('form_fields').lean();
  if (!ot) throw new ApiError(404, "Occasion type not found");

  for (const field of (ot.form_fields || [])) {
    const key = field.key || field.label.replace(/\s+/g, '_').toLowerCase();
    if (field.is_required && !occasionData?.[key]) {
      throw new ApiError(400, `Required field missing: ${field.label}`);
    }
  }
};

/** Resolve site – validates capacity, returns denormalized name/state info */
const resolveSite = async (siteId, treesNeeded) => {
  if (!siteId) return { site_name: "Unknown Site", state_id: null, state_name: "" };

  const doc = await Site.findById(siteId)
    .select('site_name capacity planted_count state_id')
    .populate('state_id', 'state_name')
    .lean();
  if (!doc) throw new ApiError(404, "Site not found");

  if (doc.capacity !== -1 && doc.planted_count + treesNeeded > doc.capacity) {
    const remaining = doc.capacity - doc.planted_count;
    throw new ApiError(400, `Site capacity exceeded – only ${remaining} spot(s) remaining`);
  }

  return {
    site_name: doc.site_name,
    state_id: doc.state_id?._id || null,
    state_name: doc.state_id?.state_name || ""
  };
};

/**
 * Normalise plants input: accept array or shorthand (species_id / plant_id).
 * Returns raw plantsArray ready for enrichPlants().
 */
const normalisePlantsInput = (data) => {
  // Priority: structured 'plants' array
  let arr = parsePlants(data.plants);
  if (arr.length) return arr;

  // Fallback: single plant shorthand (species_id / plant_id)
  if (data.species_id || data.plant_id) {
    return [{
      plant_id: data.species_id || data.plant_id,
      quantity: Number(data.trees_count || data.quantity || 1),
      tree_height: data.tree_height || data.height || ""
    }];
  }
  return [];
};

/**
 * Extract occasion_data from request body.
 * Falls back to collecting non-structural root fields (legacy support).
 */
const extractOccasionData = (data) => {
  let occasion_data = safeParseJSON(data.occasion_data, {});
  if (typeof occasion_data !== 'object' || occasion_data === null) {
    occasion_data = {};
  }

  // Fallback: only if occasion_data is truly empty, look at root (legacy)
  if (Object.keys(occasion_data).length === 0) {
    const structuralFields = new Set([
      'user_id', 'occasion_id', 'plants', 'site_id', 'project_id', 'state_id',
      'lat', 'lng', 'amount', 'payment_status', 'transaction_id', 'source',
      'carbon_id', 'tournament_id', 'ipl_support', 'species_id', 'plant_id',
      'trees_count', 'quantity', 'tree_height', 'name', 'date', 'message',
      'location_id', 'location'
    ]);
    for (const key in data) {
      if (!structuralFields.has(key) && typeof data[key] !== 'object') {
        occasion_data[key] = data[key];
      }
    }
  }
  return occasion_data;
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  CORE INSERT (shared by all typed submit handlers)                         │
// │  Creates plantation record inside a Mongoose transaction                   │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Atomic plantation creation within a Mongoose session.
 * NOTE: planted_count increment is handled ONLY by completePlantationRecord()
 *       to avoid double-counting when payment_status is 'Completed' at creation.
 */
const insertPlantation = async (payload) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const [doc] = await Plantation.create([payload], { session });

    await session.commitTransaction();

    // Sync to SiteInventory outside transaction (eventual consistency — acceptable
    // since SiteInventory is a tracking counter, not a critical transactional record)
    if (doc.site_id && doc.plants && doc.plants.length > 0) {
      await syncToSiteInventory(doc.site_id, doc.plants);
    }

    return doc;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SHARED LIST BUILDER (pagination + minimal projection)                     │
// │  Used by all list/history endpoints — handles enrichment, translation,    │
// │  certificate check, and match detail attachment                            │
// └─────────────────────────────────────────────────────────────────────────────┘

const buildList = async ({ filter, page, limit, sort = '-createdAt', lang = 'en', isUserHistory = false }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (pageNum - 1) * limitNum;
  const sortDir = sort.startsWith('-') ? -1 : 1;
  const sortKey = sort.startsWith('-') ? sort.slice(1) : sort;

  const query = Plantation.find(filter)
    .select(isUserHistory ? `${LIST_SELECT} message plants` : LIST_SELECT)
    .populate('user_id', 'name mobile email')
    .populate('occasion_id', 'name')
    .populate('tournament_id', 'name short_name')
    .populate('carbon_id', 'total total_tonnes period')
    .sort({ [sortKey]: sortDir })
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Run find + count in parallel
  const [data, total] = await Promise.all([query, Plantation.countDocuments(filter)]);

  // Collect IDs for batch enrichments (matches + teams + certificates)
  const matchIds = data
    .filter(p => p.ipl_support && p.ipl_support.match_id)
    .map(p => p.ipl_support.match_id);

  const teamIds = data
    .filter(p => p.ipl_support && p.ipl_support.team_id && !p.ipl_support.team_name)
    .map(p => p.ipl_support.team_id);

  const plantationIds = data.map(p => p._id);

  // Run match enrichment + certificate lookup in parallel
  const [matches, teams, issued] = await Promise.all([
    matchIds.length > 0
      ? Match.find({ _id: { $in: matchIds } })
        .populate('team1_id', 'team_name team_short_name')
        .populate('team2_id', 'team_name team_short_name')
        .lean()
      : [],
    teamIds.length > 0
      ? Team.find({ _id: { $in: teamIds } }).select('team_name').lean()
      : [],
    plantationIds.length > 0
      ? Certificate.find({ plantation_id: { $in: plantationIds } }).select('plantation_id certificate_id').lean()
      : []
  ]);

  // Build match details map
  if (matches.length > 0) {
    const matchMap = matches.reduce((acc, m) => {
      acc[m._id.toString()] = {
        name: `${m.team1_id?.team_short_name || 'T1'} vs ${m.team2_id?.team_short_name || 'T2'}`,
        full_name: `${m.team1_id?.team_name || 'Team 1'} vs ${m.team2_id?.team_name || 'Team 2'}`,
        date: m.match_date,
        time: m.match_time,
        venue: m.venue
      };
      return acc;
    }, {});

    data.forEach(p => {
      if (p.ipl_support && p.ipl_support.match_id) {
        const mid = p.ipl_support.match_id.toString();
        if (matchMap[mid]) p.ipl_support.match_details = matchMap[mid];
      }
    });
  }

  // Build team details map
  if (teams.length > 0) {
    const teamMap = teams.reduce((acc, t) => {
      acc[t._id.toString()] = t.team_name;
      return acc;
    }, {});

    data.forEach(p => {
      if (p.ipl_support && p.ipl_support.team_id && !p.ipl_support.team_name) {
        const tid = p.ipl_support.team_id.toString();
        if (teamMap[tid]) p.ipl_support.team_name = teamMap[tid];
      }
    });
  }

  // Translate if needed
  if (lang !== 'en') {
    const targets = data.flatMap(p => [p.occasion_id, p.tournament_id].filter(Boolean));
    if (targets.length) await translateData(targets, ['name'], lang);
  }

  // Build certificate map
  const certMap = new Map(issued.map(c => [c.plantation_id.toString(), c.certificate_id]));

  return {
    data: data.map(p => {
      const tc = Number(p.trees_count) || 0;
      const pc = Number(p.planted_count) || 0;
      let ps = 'Pending';
      if (pc > 0 && pc < tc) ps = 'Partially Planted';
      else if (pc >= tc && tc > 0) ps = 'Fully Planted';

      return {
        ...p,
        certificate_id: certMap.get(p._id.toString()) || null,
        certificate_issued: certMap.has(p._id.toString()),
        mobile: p.user_id?.mobile || null,
        planted_trees: pc,
        remaining_trees: Math.max(0, tc - pc),
        plantation_status: ps, // Overwrite with dynamic calc
        carbon_offset_kg: tc * CO2_KG_PER_TREE,
        occasion_name: p.occasion_id?.name || null,
        team_name: p.ipl_support?.team_name || null,
        match_name: p.ipl_support?.match_details?.name || null
      };
    }),
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  };
};

// ─── Minimal submit response projection ──────────────────────────────────────
const fetchSubmitResult = async (id, populateExtra = []) => {
  let q = Plantation.findById(id)
    .select(DETAIL_SELECT)
    .populate('user_id', 'name mobile email')
    .populate('site_id', 'site_name lat lng')
    .populate('plants.plant_id', 'name species_image');

  for (const [path, sel] of populateExtra) q = q.populate(path, sel);

  // Run plantation query and certificate query in parallel
  const [doc, cert] = await Promise.all([
    q.lean(),
    Certificate.findOne({ plantation_id: id }).select('certificate_id').lean()
  ]);

  if (!doc) return null;

  // Enrichment: Attach match details for IPL-Match
  if (doc.ipl_support && doc.ipl_support.match_id) {
    const m = await Match.findById(doc.ipl_support.match_id)
      .populate('team1_id', 'team_name team_short_name')
      .populate('team2_id', 'team_name team_short_name')
      .lean();
    if (m) {
      doc.ipl_support.match_details = {
        name: `${m.team1_id?.team_short_name || 'T1'} vs ${m.team2_id?.team_short_name || 'T2'}`,
        full_name: `${m.team1_id?.team_name || 'Team 1'} vs ${m.team2_id?.team_name || 'Team 2'}`,
        date: m.match_date,
        time: m.match_time,
        venue: m.venue
      };
    }
  }

  // Enrichment: Attach team name for IPL-Team if missing
  if (doc.ipl_support && doc.ipl_support.team_id && !doc.ipl_support.team_name) {
    const t = await Team.findById(doc.ipl_support.team_id).select('team_name').lean();
    if (t) {
      doc.ipl_support.team_name = t.team_name;
    }
  }

  const tc = Number(doc.trees_count) || 0;
  const pc = Number(doc.planted_count) || 0;
  let ps = 'Pending';
  if (pc > 0 && pc < tc) ps = 'Partially Planted';
  else if (pc >= tc && tc > 0) ps = 'Fully Planted';

  return {
    ...doc,
    certificate_id: cert?.certificate_id || null,
    certificate_issued: !!cert,
    mobile: doc.user_id?.mobile || null,
    planted_trees: pc,
    remaining_trees: Math.max(0, tc - pc),
    plantation_status: ps,
    occasion_name: doc.occasion_id?.name || null,
    team_name: doc.ipl_support?.team_name || null,
    match_name: doc.ipl_support?.match_details?.name || null
  };
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 1: INTERNAL EXPORT                                                │
// │  completePlantationRecord — Called by payment.controller.js after payment  │
// │  Marks payment as Completed, increments site count, creates Order,         │
// │  and executes IPL support logic if applicable                              │
// └─────────────────────────────────────────────────────────────────────────────┘

export const completePlantationRecord = async (plantationId, transactionId, session = null) => {
  const plantation = await Plantation.findById(plantationId).session(session);
  if (!plantation) return null;

  const alreadyDone = plantation.payment_status === 'Completed';
  plantation.payment_status = 'Completed';
  if (transactionId) plantation.transaction_id = transactionId;
  await plantation.save({ session });

  if (!alreadyDone && plantation.site_id) {
    const countToAdd = Number(plantation.trees_count);
    if (countToAdd > 0) {
      const ok = await Site.findOneAndUpdate(
        {
          _id: plantation.site_id,
          $or: [
            { capacity: -1 },
            { $expr: { $lte: [{ $add: ['$planted_count', countToAdd] }, '$capacity'] } }
          ]
        },
        { $inc: { planted_count: countToAdd } },
        { new: true, session }
      );
      if (!ok) console.error(`[Capacity] Could not increment site ${plantation.site_id} – may be full`);
    }
  }

  // Upsert Order
  const orderFilter = { plantation_site_id: plantation._id };
  const orderData = {
    user_id: plantation.user_id,
    type: 'Individual',
    plantation_site_id: plantation._id,
    occasion_id: plantation.occasion_id,
    carbon_id: plantation.carbon_id,
    tournament_id: plantation.tournament_id,
    site_id: plantation.site_id,
    source: plantation.source || 'General',
    trees_count: plantation.trees_count,
    amount: plantation.amount || 0,
    payment_status: 'Paid',
    order_status: 'Completed',
    execution_date: new Date(),
    remarks: `Auto from plantation ${plantation._id}`
  };

  // Execute IPL Support if applicable
  if (plantation.ipl_support && !plantation.is_support_executed) {
    try {
      await executeSupportInternal(plantation);
    } catch (err) {
      console.error(`[IPL Support] Failed to execute for plantation ${plantation._id}:`, err.message);
    }
  }

  let order = await Order.findOne(orderFilter).session(session);
  if (!order) {
    // Mongoose create with session returns an array of documents
    const created = await Order.create([orderData], { session });
    order = created[0];
  } else {
    order.payment_status = 'Paid';
    order.order_status = 'Completed';
    await order.save({ session });
  }

  return { plantation, order };
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 2: PLANT LIST                                                     │
// │  API 2.1 — GET/POST /plants/list                                           │
// │  Returns available species with price & height for the plantation form     │
// └─────────────────────────────────────────────────────────────────────────────┘

export const getPlantList = asyncHandler(async (req, res) => {
  const p = { ...req.body, ...req.query };
  const lang = p.lang || req.headers.lang || 'en';
  const isAdmin = isAdminUser(req.user);
  const page = Math.max(1, Number(p.page) || 1);
  const limit = Math.min(100, Number(p.limit) || 10);
  const sort = p.sort || 'name';

  if (!p.state_id && !p.site_id && !p.project_id && !isAdmin) {
    return res.json({ status: true, message: "Select a state or site to view species", data: [] });
  }

  const filter = {};
  if (p.state_id) filter.state_id = p.state_id;
  if (p.site_id || p.project_id) filter.site_id = p.site_id || p.project_id;
  if (p.status !== undefined) filter.status = p.status === 'true' || p.status === true;
  else if (!isAdmin) filter.status = { $ne: false };
  if (p.search) filter.name = { $regex: p.search, $options: 'i' };

  const sortDir = sort.startsWith('-') ? -1 : 1;
  const sortKey = sort.startsWith('-') ? sort.slice(1) : sort;
  const skip = (page - 1) * limit;

  const [plants, total] = await Promise.all([
    Species.find(filter)
      .select('name species_image variations status state_id site_id')
      .populate('state_id', 'state_name')
      .populate('site_id', 'site_name')
      .sort({ [sortKey]: sortDir })
      .skip(skip)
      .limit(limit)
      .lean(),
    Species.countDocuments(filter)
  ]);

  let data = plants.map(sp => {
    const v = sp.variations?.[0] || {};
    return {
      _id: sp._id,
      name: sp.name,
      species_image: sp.species_image || null,
      price: v.price || 0,
      tree_height: v.height || "",
      variations: sp.variations || [], // Return all variations so frontend can choose heights
      status: sp.status,
      state_id: sp.state_id,
      site_id: sp.site_id
    };
  });

  if (lang !== 'en') data = await translateData(data, ['name'], lang);

  res.json({
    status: true,
    message: "Plant list fetched",
    data,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) }
  });
});

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 3.1: OCCASION PLANTATION                                          │
// │  API 3.1 — POST /plantations/submit/occasion (User — submit)              │
// │  API 4.1 — POST /plantations/list/occasion   (Admin — list)               │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * POST /plantations/submit/occasion
 * Body: occasion_id*, plants* | (species_id + trees_count), site_id,
 *       occasion_data, name, date, message, payment_status, lat, lng
 */
export const submitOccasionPlantation = asyncHandler(async (req, res) => {
  const data = req.body;
  const user_id = resolveUserId(req);

  if (!data.occasion_id) throw new ApiError(400, "occasion_id is required");

  const occasion_data = extractOccasionData(data);

  const plantsRaw = normalisePlantsInput(data);

  const [{ enriched, totalTrees, totalAmount }] = await Promise.all([
    enrichPlants(plantsRaw),
    validateOccasionFields(data.occasion_id, occasion_data)
  ]);

  const siteInfo = data.site_id
    ? await resolveSite(data.site_id, totalTrees)
    : { site_name: data.site_name || "Unknown Site", state_id: data.state_id || null, state_name: "" };

  const doc = await insertPlantation({
    user_id,
    source: 'Occasion',
    occasion_id: data.occasion_id,
    occasion_data,
    name: data.name,
    date: data.date || new Date(),
    message: data.message || "",
    lat: data.lat, lng: data.lng,
    trees_count: totalTrees,
    amount: totalAmount || Number(data.amount) || 0,
    plants: enriched,
    site_id: data.site_id || data.project_id || null, // project_id is an alias
    site_name: siteInfo.site_name,
    state_id: siteInfo.state_id,
    state_name: siteInfo.state_name,
    payment_status: data.payment_status || 'Pending',
    transaction_id: data.transaction_id || null
  });

  if (doc.payment_status === 'Completed') {
    await completePlantationRecord(doc._id, data.transaction_id).catch(console.error);
  }

  const result = await fetchSubmitResult(doc._id, [['occasion_id', 'name']]);

  return res.status(201).json({
    status: true,
    message: "Occasion plantation submitted",
    data: { ...result, carbon_offset_kg: totalTrees * CO2_KG_PER_TREE }
  });
});

/**
 * POST /plantations/list/occasion  (admin)
 * Body: occasion_id?, payment_status?, page, limit, sort, lang
 */
export const getOccasionPlantations = asyncHandler(async (req, res) => {
  const { page, limit, sort, lang, occasion_id, payment_status } = req.body || {};

  const filter = { source: 'Occasion' };
  if (occasion_id) filter.occasion_id = occasion_id;
  if (payment_status) filter.payment_status = payment_status;

  const result = await buildList({ filter, page, limit, sort, lang });

  res.json({ status: true, message: "Occasion submissions fetched", ...result });
});

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 3.2: IPL TEAM SUPPORT PLANTATION                                  │
// │  API 3.2 — POST /plantations/submit/ipl-team (User — submit)              │
// │  API 4.2 — POST /plantations/list/ipl-team   (Admin — list)               │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * POST /plantations/submit/ipl-team
 * Body: tournament_id*, team_id|team_name*, plants*, site_id,
 *       name, date, message, payment_status, lat, lng
 */
export const submitIplTeamSupportPlantation = asyncHandler(async (req, res) => {
  const data = req.body;
  const user_id = resolveUserId(req);

  if (!data.tournament_id) throw new ApiError(400, "tournament_id is required");
  if (!data.team_id && !data.team_name) throw new ApiError(400, "team_id or team_name is required");

  const plantsRaw = normalisePlantsInput(data);
  if (!plantsRaw.length) throw new ApiError(400, "At least one plant selection is required");

  const { enriched, totalTrees, totalAmount } = await enrichPlants(plantsRaw);

  const siteInfo = data.site_id
    ? await resolveSite(data.site_id, totalTrees)
    : { site_name: data.site_name || "Unknown Site", state_id: data.state_id || null, state_name: "" };

  const ipl_support = { support_type: 'team', team_id: data.team_id || null, team_name: data.team_name || null, match_id: null };

  const doc = await insertPlantation({
    user_id,
    source: 'Tournament',
    tournament_id: data.tournament_id,
    ipl_support,
    name: data.name,
    date: data.date || new Date(),
    message: data.message || "",
    lat: data.lat, lng: data.lng,
    trees_count: totalTrees,
    amount: totalAmount || Number(data.amount) || 0,
    plants: enriched,
    site_id: data.site_id || data.project_id || null, // project_id is an alias
    site_name: siteInfo.site_name,
    state_id: siteInfo.state_id,
    state_name: siteInfo.state_name,
    payment_status: data.payment_status || 'Pending',
    transaction_id: data.transaction_id || null
  });

  if (doc.payment_status === 'Completed') {
    await completePlantationRecord(doc._id, data.transaction_id).catch(console.error);
  }

  const result = await fetchSubmitResult(doc._id, [['tournament_id', 'name short_name']]);

  return res.status(201).json({
    status: true,
    message: "IPL team support submitted",
    data: { ...result, carbon_offset_kg: totalTrees * CO2_KG_PER_TREE }
  });
});

/**
 * POST /plantations/list/ipl-team  (admin)
 * Body: tournament_id?, team_id?, payment_status?, page, limit, sort, lang
 */
export const getIplTeamSupportPlantations = asyncHandler(async (req, res) => {
  const { page, limit, sort, lang, tournament_id, team_id, payment_status } = req.body || {};

  const filter = { source: 'Tournament', 'ipl_support.support_type': 'team' };
  if (tournament_id) filter.tournament_id = tournament_id;
  if (team_id) filter['ipl_support.team_id'] = team_id;
  if (payment_status) filter.payment_status = payment_status;

  const result = await buildList({ filter, page, limit, sort, lang });

  res.json({ status: true, message: "IPL team support plantations fetched", ...result });
});

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 3.3: IPL MATCH (DOT BALL) SUPPORT PLANTATION                      │
// │  API 3.3 — POST /plantations/submit/ipl-match (User — submit)             │
// │  API 4.3 — POST /plantations/list/ipl-match   (Admin — list)              │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * POST /plantations/submit/ipl-match
 * Body: tournament_id*, match_id*, team_id|team_name*, plants*,
 *       site_id, name, date, message, payment_status, lat, lng
 */
export const submitIplMatchSupportPlantation = asyncHandler(async (req, res) => {
  const data = req.body;
  const user_id = resolveUserId(req);

  if (!data.tournament_id) throw new ApiError(400, "tournament_id is required");
  if (!data.match_id) throw new ApiError(400, "match_id is required");
  if (!data.team_id && !data.team_name) throw new ApiError(400, "team_id or team_name is required");

  const plantsRaw = normalisePlantsInput(data);
  if (!plantsRaw.length) throw new ApiError(400, "At least one plant selection is required");

  const { enriched, totalTrees, totalAmount } = await enrichPlants(plantsRaw);

  const siteInfo = data.site_id
    ? await resolveSite(data.site_id, totalTrees)
    : { site_name: data.site_name || "Unknown Site", state_id: data.state_id || null, state_name: "" };

  const ipl_support = { support_type: 'match', match_id: data.match_id, team_id: data.team_id || null, team_name: data.team_name || null };

  const doc = await insertPlantation({
    user_id,
    source: 'Tournament',
    tournament_id: data.tournament_id,
    ipl_support,
    name: data.name,
    date: data.date || new Date(),
    message: data.message || "",
    lat: data.lat, lng: data.lng,
    trees_count: totalTrees,
    amount: totalAmount || Number(data.amount) || 0,
    plants: enriched,
    site_id: data.site_id || data.project_id || null, // project_id is an alias
    site_name: siteInfo.site_name,
    state_id: siteInfo.state_id,
    state_name: siteInfo.state_name,
    payment_status: data.payment_status || 'Pending',
    transaction_id: data.transaction_id || null
  });

  if (doc.payment_status === 'Completed') {
    await completePlantationRecord(doc._id, data.transaction_id).catch(console.error);
  }

  const result = await fetchSubmitResult(doc._id, [['tournament_id', 'name short_name']]);

  return res.status(201).json({
    status: true,
    message: "IPL match support submitted",
    data: { ...result, carbon_offset_kg: totalTrees * CO2_KG_PER_TREE }
  });
});

/**
 * POST /plantations/list/ipl-match  (admin)
 * Body: tournament_id?, match_id?, team_id?, payment_status?, page, limit, sort, lang
 */
export const getIplMatchSupportPlantations = asyncHandler(async (req, res) => {
  const { page, limit, sort, lang, tournament_id, match_id, team_id, payment_status } = req.body || {};

  const filter = { source: 'Tournament', 'ipl_support.support_type': 'match' };
  if (tournament_id) filter.tournament_id = tournament_id;
  if (match_id) filter['ipl_support.match_id'] = match_id;
  if (team_id) filter['ipl_support.team_id'] = team_id;
  if (payment_status) filter.payment_status = payment_status;

  const result = await buildList({ filter, page, limit, sort, lang });

  res.json({ status: true, message: "IPL match support plantations fetched", ...result });
});

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 3.4: CARBON OFFSET PLANTATION                                     │
// │  API 3.4 — POST /plantations/submit/carbon (User — submit)                │
// │  API 4.4 — POST /plantations/list/carbon   (Admin — list, + total CO2)    │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * POST /plantations/submit/carbon
 * Body: carbon_id*, plants* | (species_id + trees_count), site_id,
 *       name, date, message, payment_status, lat, lng
 */
export const submitCarbonOffsetPlantation = asyncHandler(async (req, res) => {
  const data = req.body;
  const user_id = resolveUserId(req);

  if (!data.carbon_id) throw new ApiError(400, "carbon_id is required");

  const plantsRaw = normalisePlantsInput(data);
  if (!plantsRaw.length) throw new ApiError(400, "At least one plant selection is required");

  const { enriched, totalTrees, totalAmount } = await enrichPlants(plantsRaw);

  const siteInfo = data.site_id
    ? await resolveSite(data.site_id, totalTrees)
    : { site_name: data.site_name || "Unknown Site", state_id: data.state_id || null, state_name: "" };

  const doc = await insertPlantation({
    user_id,
    source: 'Carbon',
    carbon_id: data.carbon_id,
    name: data.name,
    date: data.date || new Date(),
    message: data.message || "",
    lat: data.lat, lng: data.lng,
    trees_count: totalTrees,
    amount: totalAmount || Number(data.amount) || 0,
    plants: enriched,
    site_id: data.site_id || data.project_id || null,
    site_name: siteInfo.site_name,
    state_id: siteInfo.state_id,
    state_name: siteInfo.state_name,
    payment_status: data.payment_status || 'Pending',
    transaction_id: data.transaction_id || null
  });

  if (doc.payment_status === 'Completed') {
    await completePlantationRecord(doc._id, data.transaction_id).catch(console.error);
  }

  const result = await fetchSubmitResult(doc._id, [['carbon_id', 'total total_tonnes period']]);

  return res.status(201).json({
    status: true,
    message: "Carbon offset plantation submitted",
    data: { ...result, carbon_offset_kg: totalTrees * CO2_KG_PER_TREE }
  });
});

/**
 * POST /plantations/list/carbon  (admin)
 * Body: carbon_id?, payment_status?, page, limit, sort, lang
 */
export const getCarbonOffsetPlantations = asyncHandler(async (req, res) => {
  const { page, limit, sort, lang, carbon_id, payment_status } = req.body || {};

  const filter = { source: 'Carbon' };
  if (carbon_id) filter.carbon_id = carbon_id;
  if (payment_status) filter.payment_status = payment_status;

  const result = await buildList({ filter, page, limit, sort, lang });
  const totalCO2 = result.data.reduce((s, p) => s + (Number(p.trees_count) || 0), 0) * CO2_KG_PER_TREE;

  res.json({ status: true, message: "Carbon offset plantations fetched", total_carbon_offset_kg: totalCO2, ...result });
});

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 3.5: GENERIC / BACKWARD-COMPATIBLE SUBMIT                         │
// │  API 3.5 — POST /plantations/add (User — auto-detect source)              │
// │  Kept for legacy app versions, auto-derives source from fields present    │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * POST /plantations/add  (generic – kept for existing integrations)
 * Auto-derives source from fields present.
 */
export const submitPlantation = asyncHandler(async (req, res) => {
  const data = req.body;
  const user_id = resolveUserId(req);

  const plantsRaw = normalisePlantsInput(data);
  const site_id = data.site_id || data.project_id || data.location_id || null;
  const occasion_data = extractOccasionData(data);

  const [{ enriched, totalTrees, totalAmount }] = await Promise.all([
    enrichPlants(plantsRaw),
    validateOccasionFields(data.occasion_id, occasion_data)
  ]);

  const siteInfo = site_id
    ? await resolveSite(site_id, totalTrees)
    : { site_name: data.site_name || data.location || "Unknown Site", state_id: data.state_id || null, state_name: "" };

  const source = data.source || (
    data.carbon_id ? 'Carbon' :
      data.occasion_id ? 'Occasion' :
        data.tournament_id ? 'Tournament' : 'General'
  );

  const doc = await insertPlantation({
    user_id,
    source,
    occasion_id: data.occasion_id || null,
    carbon_id: data.carbon_id || null,
    tournament_id: data.tournament_id || null,
    ipl_support: data.ipl_support || null,
    occasion_data,
    name: data.name,
    date: data.date || new Date(),
    message: data.message || "",
    lat: data.lat, lng: data.lng,
    trees_count: totalTrees,
    amount: totalAmount || Number(data.amount) || 0,
    plants: enriched,
    site_id,
    site_name: siteInfo.site_name,
    state_id: siteInfo.state_id,
    state_name: siteInfo.state_name,
    payment_status: data.payment_status || 'Pending',
    transaction_id: data.transaction_id || null
  });

  if (doc.payment_status === 'Completed') {
    await completePlantationRecord(doc._id, data.transaction_id).catch(console.error);
  }

  const result = await fetchSubmitResult(doc._id, [
    ['occasion_id', 'name'],
    ['carbon_id', 'total total_tonnes period'],
    ['tournament_id', 'name short_name']
  ]);

  return res.status(201).json({
    status: true,
    message: "Plantation submitted",
    data: { ...result, carbon_offset_kg: totalTrees * CO2_KG_PER_TREE }
  });
});


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │  SECTION 5: USER HISTORY + ADMIN MUTATIONS                                 │
// │  API 5.1 — POST /plantations/history  (User — own records)                 │
// │  API 5.2 — PUT  /plantations/update   (Admin — edit record)                │
// │  API 5.3 — DELETE /plantations/delete (Admin — remove record)              │
// │  API 4.5 — POST /plantations/list     (Admin — all types, generic filter)  │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * POST /plantations/history  (logged-in user's own records)
 * Body: status?, source?, page, limit, lang
 */
export const getPlantationHistory = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const user_id = resolveUserId(req);

  const filter = { user_id };
  if (body.status) filter.payment_status = body.status;
  if (body.source) filter.source = body.source;

  const result = await buildList({
    filter,
    page: body.page,
    limit: body.limit,
    lang: body.lang,
    isUserHistory: true
  });

  const totalTrees = result.data.reduce((s, p) => s + (Number(p.trees_count) || 0), 0);

  res.json({
    status: true,
    data: result.data,
    total_trees_count: totalTrees,
    carbon_offset_kg: totalTrees * CO2_KG_PER_TREE,
    pagination: result.pagination
  });
});

/**
 * POST /plantations/list  (admin – all, any filter)
 * Body: user_id?, payment_status?, source?, state_id?, page, limit, sort, lang
 */
export const getAllPlantations = asyncHandler(async (req, res) => {
  const { page, limit, sort, lang, user_id, payment_status, source, state_id } = req.body || {};

  const filter = {};
  if (user_id) filter.user_id = user_id;
  if (payment_status) filter.payment_status = payment_status;
  if (source) filter.source = source;

  if (state_id) {
    const siteIds = await Site.find({ state_id }).distinct('_id');
    filter.site_id = { $in: siteIds };
  }

  const result = await buildList({ filter, page, limit, sort, lang });

  res.json({ status: true, message: "Plantations fetched", ...result });
});

/**
 * PUT /plantations/update  (admin)
 * Blocks overwrite of critical and computed fields.
 */
export const updatePlantation = asyncHandler(async (req, res) => {
  const id = req.body.id || req.query.id || req.params.id;
  if (!id) throw new ApiError(400, "Plantation ID required");

  // Block overwrite of critical computed/identity fields through update
  const {
    plants, trees_count, source, user_id, payment_status,
    site_id, planted_count, is_support_executed, ipl_support,
    _id, createdAt, updatedAt, __v,
    ...safeBody
  } = req.body;

  const doc = await Plantation.findByIdAndUpdate(id, { $set: safeBody }, { new: true, runValidators: true })
    .select(LIST_SELECT)
    .lean();
  if (!doc) throw new ApiError(404, "Plantation not found");

  res.json({ status: true, message: "Plantation updated", data: doc });
});

/**
 * DELETE /plantations/delete  (admin)
 */
export const deletePlantation = asyncHandler(async (req, res) => {
  const id = req.body.id || req.query.id || req.params.id;
  if (!id) throw new ApiError(400, "Plantation ID required");

  const doc = await Plantation.findByIdAndDelete(id).select('payment_status site_id trees_count plants').lean();
  if (!doc) throw new ApiError(404, "Plantation not found");

  if (doc.payment_status === 'Completed' && doc.site_id) {
    // Decrement total site planted_count
    await Site.findByIdAndUpdate(doc.site_id, { $inc: { planted_count: -Number(doc.trees_count) } })
      .catch(e => console.error("[Delete] Failed to decrement site planted_count:", e));

    // Decrement species-level counts in SiteInventory
    if (doc.plants && doc.plants.length > 0) {
      const ops = doc.plants.map(p => ({
        updateOne: {
          filter: {
            site_id: doc.site_id,
            species_id: p.plant_id,
            tree_height: p.tree_height || ""
          },
          update: { $inc: { ordered_count: -(Number(p.quantity) || 0) } }
        }
      }));
      if (ops.length > 0) {
        await SiteInventory.bulkWrite(ops).catch(e => console.error("[Delete] Failed to decrement SiteInventory:", e));
      }
    }
  }

  res.json({ status: true, message: "Plantation deleted" });
});
