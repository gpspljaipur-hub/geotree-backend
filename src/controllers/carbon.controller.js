import Carbon from "../models/carbon.model.js";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import EmissionFactor from "../models/emissionFactor.model.js";
import OffsetFactor from "../models/offsetFactor.model.js";
import Species from "../models/species.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { translateData } from "../utils/translation.util.js";
import { getRequestParams, parseBoolean } from "../utils/request.util.js";
import Site from "../models/site.model.js";
import State from "../models/state.model.js";

// --- constants & cache ---
let cachedEmissionFactors = null;
let factorsLastUpdated = 0;
let isSeeded = false;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour


const SEED_FACTORS = [
  { category: 'transport', sub_category: 'Car (Diesel)', value: 'car_diesel', factor: 0.17, unit: 'kg/km' },
  { category: 'transport', sub_category: 'Car (Petrol)', value: 'car_petrol', factor: 0.19, unit: 'kg/km' },
  { category: 'transport', sub_category: 'Motorbike', value: 'motorbike', factor: 0.10, unit: 'kg/km' },
  { category: 'transport', sub_category: 'Bus', value: 'bus', factor: 0.089, unit: 'kg/km' },
  { category: 'transport', sub_category: 'Train', value: 'train', factor: 0.04, unit: 'kg/km' },
  { category: 'transport', sub_category: 'Flight (Long Haul)', value: 'flight_long', factor: 450, unit: 'kg/flight' },
  { category: 'transport', sub_category: 'Flight (Short Haul)', value: 'flight_short', factor: 150, unit: 'kg/flight' },
  { category: 'energy', sub_category: 'Electricity', value: 'electricity', factor: 0.82, unit: 'kg/kWh' },
  { category: 'energy', sub_category: 'LPG', value: 'lpg', factor: 42.6, unit: 'kg/kg' },
  { category: 'waste', sub_category: 'General Waste', value: 'waste', factor: 0.45, unit: 'kg/kg' },
  { category: 'food', sub_category: 'Non-Vegetarian', value: 'non_vegetarian', factor: 7.0, unit: 'kg/meal' },
  { category: 'food', sub_category: 'Vegetarian', value: 'vegetarian', factor: 2.0, unit: 'kg/meal' },
  { category: 'food', sub_category: 'Vegan', value: 'vegan', factor: 1.5, unit: 'kg/meal' }
];

const DEFAULT_SPECIES = [
  { name: "Neem", co2_absorption: 20 },
  { name: "Peepal", co2_absorption: 28 },
  { name: "Banyan", co2_absorption: 30 }
];

// --- helpers ---

const invalidateCache = () => {
  cachedEmissionFactors = null;
  factorsLastUpdated = 0;
};

const getCachedFactors = async () => {
  if (!isSeeded) {
    const count = await EmissionFactor.countDocuments();
    if (count === 0) await EmissionFactor.insertMany(SEED_FACTORS);
    isSeeded = true;
  }

  if (cachedEmissionFactors && (Date.now() - factorsLastUpdated < CACHE_TTL)) {
    return cachedEmissionFactors;
  }

  const factors = await EmissionFactor.find({ status: { $ne: false } }).lean();
  cachedEmissionFactors = factors;
  factorsLastUpdated = Date.now();
  return factors;
};

const deriveValue = (str) => str.split('(')[0].trim().toLowerCase().replace(/\s+/g, '_');

const generateRecommendations = async (totalKg, speciesList, lang = 'en', state_id = null) => {

  const targetSpecies = speciesList.length > 0 ? speciesList : DEFAULT_SPECIES;

  // Find all sites that contain these species to show all locations
  const speciesIds = targetSpecies.map(s => s._id).filter(id => id && mongoose.isValidObjectId(id));
  let sites = speciesIds.length > 0
    ? await Site.find({
      native_species: { $in: speciesIds },
      ...(state_id ? { state_id } : {})
    })
      .populate("state_id", "state_name")
      .lean()
    : [];

  // Fallback: If no sites found for these species but we have a state context, 
  // ensure we have at least one site from that state to avoid "N/A" in primary display
  if (state_id && !sites.some(st => st.state_id?._id?.toString() === state_id.toString())) {
    const genericSite = await Site.findOne({ state_id, status: true })
      .populate("state_id", "state_name")
      .lean();
    if (genericSite) sites.push(genericSite);
  }

  // Translation
  let translatedSpecies = targetSpecies;
  let translatedSites = sites;

  if (lang !== 'en') {
    const sumTasks = [
      translateData(targetSpecies, ['name', 'description'], lang),
      translateData(sites, ['site_name'], lang)
    ];
    const [spRes, siRes] = await Promise.all(sumTasks);
    translatedSpecies = spRes;
    translatedSites = siRes;

    // Translate state names populated in sites
    const statesToTranslate = translatedSites.map(s => s.state_id).filter(st => st && st.state_name);
    if (statesToTranslate.length > 0) {
      await translateData(statesToTranslate, ['state_name'], lang);
    }
  }

  const siteMap = {};
  translatedSites.forEach(site => {
    (site.native_species || []).forEach(specId => {
      const idStr = specId.toString();
      if (!siteMap[idStr]) siteMap[idStr] = [];
      siteMap[idStr].push({
        site_id: site._id,
        site_name: site.site_name,
        state_id: site.state_id?._id || null,
        state_name: site.state_id?.state_name || "N/A"
      });
    });
  });

  return translatedSpecies.map(s => {
    const absorption = s.co2_absorption || 20;
    const count = Math.ceil(totalKg / absorption);
    const idStr = s._id?.toString();
    const locations = siteMap[idStr] || [];

    // Fallback: If no species-specific direct site mapping found, attempt state-based association
    if (locations.length === 0) {
      // 1. Try to find any site from the same state (robust comparison handles populated and raw IDs)
      const targetStateId = (s.state_id?._id || s.state_id || state_id)?.toString();
      const stFallback = translatedSites.find(st => {
        const siteStateId = (st.state_id?._id || st.state_id)?.toString();
        return siteStateId === targetStateId;
      });

      if (stFallback) {
        locations.push({
          site_id: stFallback._id,
          site_name: stFallback.site_name,
          state_id: stFallback.state_id?._id || stFallback.state_id || null,
          state_name: stFallback.state_id?.state_name || "N/A"
        });
      }
      // 2. Original fallback from species document record (direct site_id field)
      else if (s.state_id || s.site_id) {
        locations.push({
          site_id: s.site_id?._id || null,
          site_name: s.site_id?.site_name || "N/A",
          state_id: s.state_id?._id || null,
          state_name: s.state_id?.state_name || "N/A"
        });
      }
    }

    return {
      id: s._id,
      name: s.name,
      image: s.species_image,
      description: s.description,
      co2_absorption_kg: absorption,
      count: count > 0 ? count : 1,
      price: s.variations?.[0]?.price || 0,
      tree_height: s.variations?.[0]?.height || "",
      // All sites and states where this species is available
      available_locations: locations,
      // Primary location for generic display
      state_id: locations[0]?.state_id || null,
      site_id: locations[0]?.site_id || null,
      state: locations[0]?.state_name || "N/A",
      site: locations[0]?.site_name || "N/A"
    };
  });
};



// --- Controllers ---

const getFactorsByCategory = async (req, res, category) => {
  await getCachedFactors(); // Ensure seeded
  const factors = await EmissionFactor.find({ category }).sort({ sub_category: 1 }).lean();
  const { lang } = getRequestParams(req);

  let data = factors.map(f => ({
    _id: f._id,
    name: f.sub_category,
    key: f.value,
    value: f.factor,
    unit: f.unit
  }));

  if (lang !== 'en') data = await translateData(data, ['name'], lang);
  res.json({ status: true, message: `${category} factors fetched`, data });
};

export const getTransportTypeList = asyncHandler(async (req, res) => getFactorsByCategory(req, res, 'transport'));
export const getElectricityList = asyncHandler(async (req, res) => getFactorsByCategory(req, res, 'energy'));
export const getFoodTypeList = asyncHandler(async (req, res) => getFactorsByCategory(req, res, 'food'));

export const submitCarbon = asyncHandler(async (req, res) => {
  let { user_id, state_id, inputs = {}, lang = 'en' } = getRequestParams(req, ['user_id', 'state_id', 'inputs', 'lang']);

  // SECURITY: Favor token ID for non-admins to prevent spoofing
  const isAdmin = ['admin', 'super_admin'].includes(req.user?.role);
  const final_user_id = (isAdmin && user_id) ? user_id : req.user?.id;

  if (!final_user_id) throw new ApiError(400, "user_id is required or token missing");

  // Cast to ObjectId for consistency and safety
  let targetUser;
  try {
    targetUser = new mongoose.Types.ObjectId(final_user_id);
  } catch (e) {
    throw new ApiError(400, "Invalid user_id format");
  }

  // Handle case where inputs are provided as a string or omitted
  if (typeof inputs === 'string') {
    try { inputs = JSON.parse(inputs); } catch (e) { }
  }

  // Use req.body directly if inputs is empty (for mobile compatibility)
  const inputSource = (inputs && Object.keys(inputs).length > 0) ? inputs : req.body;

  const factors = await getCachedFactors();
  let totalAnnualKg = 0;
  const breakdown = { transport: 0, energy: 0, food: 0, waste: 0 };

  // Mapping for mobile app compatibility
  const keyMap = {
    'electricity': ['electricity_kwh', 'electricity_units'],
    'lpg': ['lpg_kg', 'lpg_cylinders'],
    'waste': ['waste_kg'],
    'flight_long': ['flights_long', 'flight_long_haul'],
    'flight_short': ['flights_short', 'flight_short_haul'],
    'air_travel': ['flights_long', 'flight_long_haul'],
    'motorbike': ['motorbike_km'],
    'car_petrol': ['carPetrol_km', 'car_petrol_km'],
    'car_diesel': ['carDiesel_km', 'car_diesel_km'],
    'bus': ['bus_km'],
    'train': ['train_km'],
    'vegetarian': ['vegetarian_meals'],
    'non_vegetarian': ['meat_meals', 'non_veg_meals'],
    'vegan': ['vegan_meals']
  };

  factors.forEach(f => {
    let val = inputSource[f.value];
    // Check aliases if direct key not found
    if (val === undefined && keyMap[f.value]) {
      for (const alias of keyMap[f.value]) {
        if (inputSource[alias] !== undefined) {
          val = inputSource[alias];
          break;
        }
      }
    }

    const numVal = Number(val);
    if (!isNaN(numVal) && numVal > 0) {
      // Carbon footprint calculation (Monthly input * 12 to get annual)
      const annual = numVal * 12 * f.factor;
      totalAnnualKg += annual;
      if (breakdown[f.category] !== undefined) breakdown[f.category] += annual;
    }
  });

  const totalTonnes = Number((totalAnnualKg / 1000).toFixed(3));

  const breakdownPercent = {};
  Object.keys(breakdown).forEach(k => {
    breakdownPercent[k] = totalAnnualKg ? (breakdown[k] / totalAnnualKg) * 100 : 0;
  });

  // Fetch species recommendations - handle state_id vs null (for defaults)
  const final_state_id = (state_id && state_id !== 'null' && state_id !== 'undefined') ? state_id : null;
  let availableSpecies = [];

  if (final_state_id) {
    // 1. Find all sites in this state to get their native species
    const sitesInState = await Site.find({ state_id: final_state_id, status: true }).select('native_species').lean();
    const speciesIdsFromSites = sitesInState.flatMap(s => s.native_species || []).filter(id => id && mongoose.isValidObjectId(id));

    // 2. Fetch species that are either directly linked to state or linked via sites in state
    availableSpecies = await Species.find({
      status: true,
      $or: [
        { state_id: final_state_id },
        { _id: { $in: speciesIdsFromSites } }
      ]
    })
      .populate("state_id", "state_name")
      .populate("site_id", "site_name")
      .lean();
  }

  const recommendations = await generateRecommendations(totalAnnualKg, availableSpecies, lang, final_state_id);

  const entry = await Carbon.create({
    user_id: targetUser,
    state_id: final_state_id,
    inputs: inputSource,
    carbon_result: totalAnnualKg,
    total: totalAnnualKg,
    total_tonnes: totalTonnes,
    breakdown,
    breakdown_percent: breakdownPercent,
    species_recommendations: recommendations
  });

  await User.findByIdAndUpdate(targetUser, { carbon_footprint: totalAnnualKg });

  res.json({
    status: true,
    message: "Carbon calculated successfully",
    data: {
      carbon: entry,
      results: {
        total_kg: totalAnnualKg,
        total_tonnes: totalTonnes,
        breakdown,
        recommendations
      }
    }
  });
});

export const getCarbonResult = asyncHandler(async (req, res) => {
  const isAdmin = ['admin', 'super_admin'].includes(req.user?.role);
  const user_id_param = req.body.user_id || req.query.user_id;
  const final_user_id = (isAdmin && user_id_param) ? user_id_param : req.user?.id;

  if (!final_user_id) throw new ApiError(400, "Authentication required");

  // Cast to ObjectId to prevent String vs ObjectId type mismatch in queries
  let user_id;
  try {
    user_id = new mongoose.Types.ObjectId(final_user_id);
  } catch (e) {
    throw new ApiError(400, "Invalid user_id format");
  }

  const carbon = await Carbon.findOne({ user_id }).sort({ createdAt: -1 }).lean();
  if (!carbon) {
    return res.json({
      status: false,
      message: "No carbon data found for this user",
      data: null
    });
  }

  const { state_id, lang = 'en' } = getRequestParams(req, ['state_id', 'lang']);

  // Normalize state_id
  const requestedStateId = (state_id && state_id !== 'null' && state_id !== 'undefined') ? state_id : null;
  const targetStateId = requestedStateId || carbon.state_id;

  // We recalculate recommendations on-the-fly to ensure they respect the state filter
  // It also ensures that if state_id is null, it shows DEFAULT_SPECIES
  let availableSpecies = [];
  if (targetStateId) {
    // 1. Find all sites in this state to get their native species
    const sitesInState = await Site.find({ state_id: targetStateId, status: true }).select('native_species').lean();
    const speciesIdsFromSites = sitesInState.flatMap(s => s.native_species || []).filter(id => id && mongoose.isValidObjectId(id));

    // 2. Fetch species that are either directly linked to state or linked via sites in state
    availableSpecies = await Species.find({
      status: true,
      $or: [
        { state_id: targetStateId },
        { _id: { $in: speciesIdsFromSites } }
      ]
    })
      .populate("state_id", "state_name")
      .populate("site_id", "site_name")
      .lean();
  }

  const recommendations = await generateRecommendations(carbon.total, availableSpecies, lang, targetStateId);
  carbon.species_recommendations = recommendations;

  res.json({
    status: true,
    message: "Latest carbon result fetched",
    data: carbon
  });
});

export const getCarbonHistory = asyncHandler(async (req, res) => {
  const isAdmin = ['admin', 'super_admin'].includes(req.user?.role);
  const user_id_param = req.body.user_id || req.query.user_id;
  const final_user_id = (isAdmin && user_id_param) ? user_id_param : req.user?.id;

  const { page = 1, limit = 20 } = getRequestParams(req, ['page', 'limit']);
  if (!final_user_id) throw new ApiError(400, "Authentication required");

  // Type-safe ObjectId cast
  let user_id;
  try {
    user_id = new mongoose.Types.ObjectId(final_user_id);
  } catch (e) {
    throw new ApiError(400, "Invalid user_id format");
  }

  const total = await Carbon.countDocuments({ user_id });
  const history = await Carbon.find({ user_id })
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .lean();

  res.json({
    status: true,
    data: history,
    pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
  });
});

// Admin Factors CRUD
export const getEmissionFactors = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = getRequestParams(req, ['status', 'page', 'limit']);
  const filter = {};
  if (status !== undefined) filter.status = parseBoolean(status);

  const skip = (Number(page) - 1) * Number(limit);
  const [factors, total] = await Promise.all([
    EmissionFactor.find(filter)
      .sort({ category: 1, sub_category: 1 })
      .skip(skip)
      .limit(Number(limit)),
    EmissionFactor.countDocuments(filter)
  ]);

  res.json({
    status: true,
    data: factors,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    }
  });
});

export const addEmissionFactor = asyncHandler(async (req, res) => {
  if (req.file) req.body.image = `/uploads/carbon/${req.file.filename}`;
  if (!req.body.value && req.body.sub_category) req.body.value = deriveValue(req.body.sub_category);

  const factor = await EmissionFactor.create(req.body);
  invalidateCache();
  res.json({ status: true, message: "Emission factor added successfully", data: factor });
});

export const updateEmissionFactor = asyncHandler(async (req, res) => {
  const id = req.body.id || req.query.id || req.params.id;
  if (req.file) req.body.image = `/uploads/carbon/${req.file.filename}`;
  if (req.body.sub_category && !req.body.value) req.body.value = deriveValue(req.body.sub_category);

  const factor = await EmissionFactor.findByIdAndUpdate(id, req.body, { new: true });
  invalidateCache();
  res.json({ status: true, message: "Emission factor updated successfully", data: factor });
});

export const deleteEmissionFactor = asyncHandler(async (req, res) => {
  const id = req.body.id || req.query.id || req.params.id;
  await EmissionFactor.findByIdAndDelete(id);
  invalidateCache();
  res.json({ status: true, message: "Deleted" });
});

// @desc    Bulk add carbon types/factors
export const addAllTypes = asyncHandler(async (req, res) => {
  const { transport_types, electricity_types, food_types } = req.body;
  const results = { added: [], errors: [] };

  const process = async (listStr, category) => {
    try {
      const list = typeof listStr === 'string' ? JSON.parse(listStr) : (listStr || []);
      for (const item of list) {
        await EmissionFactor.create({
          category,
          sub_category: item.name,
          value: deriveValue(item.name),
          factor: Number(item.value),
          unit: 'kgCO2e/unit'
        });
        results.added.push(item.name);
      }
    } catch (e) { results.errors.push(e.message); }
  };

  if (transport_types) await process(transport_types, 'transport');
  if (electricity_types) await process(electricity_types, 'energy');
  if (food_types) await process(food_types, 'food');

  invalidateCache();
  res.json({ status: true, message: "Bulk add processed", data: results });
});

// Offset Factors CRUD
export const getOffsetFactors = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status !== undefined) filter.status = parseBoolean(status);
  const factors = await OffsetFactor.find(filter).sort({ species_name: 1 }).lean();
  res.json({ status: true, message: "Offset factors fetched successfully", data: factors });
});

export const addOffsetFactor = asyncHandler(async (req, res) => {
  const factor = await OffsetFactor.create(req.body);
  res.status(201).json({ status: true, message: "Offset factor added successfully", data: factor });
});

export const updateOffsetFactor = asyncHandler(async (req, res) => {
  const id = req.body.id || req.query.id || req.params.id;
  const factor = await OffsetFactor.findByIdAndUpdate(id, req.body, { new: true });
  if (!factor) throw new ApiError(404, "Offset factor not found");
  res.json({ status: true, message: "Offset factor updated successfully", data: factor });
});

export const deleteOffsetFactor = asyncHandler(async (req, res) => {
  const id = req.body.id || req.query.id || req.params.id;
  await OffsetFactor.findByIdAndDelete(id);
  res.json({ status: true, message: "Offset factor deleted" });
});