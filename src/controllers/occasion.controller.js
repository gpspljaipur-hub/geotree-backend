import OccasionType from "../models/occasionType.model.js";
import State from "../models/state.model.js";
import Site from "../models/site.model.js";
import Species from "../models/species.model.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import asyncHandler from "../utils/asyncHandler.js";
import { translateData } from "../utils/translation.util.js";
import { parseBoolean } from "../utils/request.util.js";
import { deleteFile } from "../utils/file.util.js";
import { saveOccasionFormHtml, deleteOccasionFormHtml } from "../utils/formGenerator.util.js";

// Configure multer for occasion type image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "public/uploads/occasion");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `occasion-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  }
});

// Multer middleware for occasion type image
const multerUpload = upload.fields([
  { name: 'occasion_image', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]);

export const uploadOccasionImageMiddleware = (req, res, next) => {
  multerUpload(req, res, (err) => {
    if (err) return next(err);
    if (req.files) {
      const file = req.files.occasion_image?.[0] || req.files.image?.[0];
      if (file) {
        req.file = file;
      }
    }
    next();
  });
};

// API 12: Get occasion type list
export const getOccasionTypeList = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const lang = body.lang || req.headers['lang'] || req.query.lang || 'en';
  const { status, page = 1, limit = 10, search, sort = 'name' } = body;
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

  const [occasionTypesData, total] = await Promise.all([
    OccasionType.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    OccasionType.countDocuments(filter)
  ]);

  let occasionTypes = occasionTypesData;

  // Ensure every object has a status field for consistency
  occasionTypes = occasionTypes.map(item => ({
    ...item,
    status: item.status !== undefined ? item.status : true
  }));

  if (lang !== 'en') {
    occasionTypes = await translateData(occasionTypes, ['name'], lang);
  }


  return res.json({
    status: true,
    message: "Occasion type list fetched",
    data: occasionTypes,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    }
  });
});

// API: Add occasion type with image
export const addOccasionType = asyncHandler(async (req, res) => {
  const { name, status, form_fields, permanent_field_overrides } = req.body;
  let parsedFormFields = [];
  let parsedOverrides = {};

  if (form_fields) {
    try {
      parsedFormFields = typeof form_fields === 'string' ? JSON.parse(form_fields) : form_fields;
    } catch (e) {
      console.error("Error parsing form_fields:", e);
    }
  }

  if (permanent_field_overrides) {
    try {
      parsedOverrides = typeof permanent_field_overrides === 'string'
        ? JSON.parse(permanent_field_overrides)
        : permanent_field_overrides;
    } catch (e) {
      console.error("Error parsing permanent_field_overrides:", e);
    }
  }

  if (!name) {
    return res.status(400).json({ status: false, message: "name is required", data: {} });
  }

  if (!req.file) {
    return res.status(400).json({ status: false, message: "occasion_image is required", data: {} });
  }

  try {
    const occasionType = await OccasionType.create({
      name,
      status: status !== undefined ? parseBoolean(status) : true,
      occasion_image: `/uploads/occasion/${req.file.filename}`,
      form_fields: parsedFormFields,
      permanent_field_overrides: parsedOverrides
    });

    // Generate and save the HTML form page; store its URL in DB
    const formHtmlUrl = saveOccasionFormHtml(occasionType.toObject());
    occasionType.form_html_url = formHtmlUrl;
    await occasionType.save();

    const occasionObj = occasionType.toObject();

    return res.json({
      status: true,
      message: "Occasion type added successfully",
      data: occasionObj
    });
  } catch (error) {
    if (req.file) {
      deleteFile(`/uploads/occasion/${req.file.filename}`);
    }
    if (error.code === 11000) {
      return res.status(400).json({ status: false, message: "Occasion type already exists", data: {} });
    }
    throw error;
  }
});

// API: Update Occasion Type
export const updateOccasionType = asyncHandler(async (req, res) => {
  const id = req.body.id || req.query.id || req.params.id;
  if (!id) return res.status(400).json({ status: false, message: "ID required" });

  const occasion = await OccasionType.findById(id);
  if (!occasion) return res.status(404).json({ status: false, message: "Occasion type not found" });

  const { name, status } = req.body;
  const updateData = {};
  if (name) updateData.name = name;
  if (status !== undefined) updateData.status = parseBoolean(status);

  if (!req.file && (req.body.occasion_image === "" || req.body.occasion_image === "null" || req.body.occasion_image === null)) {
    return res.status(400).json({ status: false, message: "occasion_image is required" });
  }

  if (req.file) {
    if (occasion.occasion_image) deleteFile(occasion.occasion_image);
    updateData.occasion_image = `/uploads/occasion/${req.file.filename}`;
  }

  if (req.body.form_fields) {
    try {
      updateData.form_fields = typeof req.body.form_fields === 'string' ? JSON.parse(req.body.form_fields) : req.body.form_fields;
    } catch (e) {
      console.error("Error parsing form_fields in update:", e);
    }
  }

  if (req.body.permanent_field_overrides) {
    try {
      updateData.permanent_field_overrides = typeof req.body.permanent_field_overrides === 'string'
        ? JSON.parse(req.body.permanent_field_overrides)
        : req.body.permanent_field_overrides;
    } catch (e) {
      console.error("Error parsing permanent_field_overrides in update:", e);
    }
  }

  const updatedOccasion = await OccasionType.findByIdAndUpdate(id, { $set: updateData }, { new: true });
  if (!updatedOccasion) return res.status(404).json({ status: false, message: "Occasion type not found" });

  // Regenerate the HTML form page whenever name or form_fields change
  const formHtmlUrl = saveOccasionFormHtml(updatedOccasion.toObject());
  updatedOccasion.form_html_url = formHtmlUrl;
  await updatedOccasion.save();

  const occasionObj = updatedOccasion.toObject();

  res.json({ status: true, message: "Occasion type updated successfully", data: occasionObj });
});

// API: Delete Occasion Type
export const deleteOccasionType = asyncHandler(async (req, res) => {
  const id = req.body.id || req.query.id || req.params.id;
  if (!id) return res.status(400).json({ status: false, message: "ID required" });

  const occasion = await OccasionType.findById(id);
  if (!occasion) return res.status(404).json({ status: false, message: "Occasion type not found" });

  if (occasion.occasion_image) deleteFile(occasion.occasion_image);

  // Delete the generated HTML form file from disk
  deleteOccasionFormHtml(occasion._id);

  await OccasionType.findByIdAndDelete(id);

  res.json({ status: true, message: "Occasion type deleted successfully" });
});

// API: Bulk regenerate HTML forms for all existing occasion types (admin backfill)
export const regenerateOccasionForms = asyncHandler(async (req, res) => {
  const occasions = await OccasionType.find({});

  const results = [];
  for (const occasion of occasions) {
    const formHtmlUrl = saveOccasionFormHtml(occasion.toObject());
    occasion.form_html_url = formHtmlUrl;
    await occasion.save();
    results.push({ id: occasion._id, name: occasion.name, form_html_url: formHtmlUrl });
  }

  res.json({
    status: true,
    message: `Regenerated HTML forms for ${results.length} occasion type(s)`,
    data: results
  });
});
// API: Get single occasion details by ID (for standalone form initialization)
export const getOccasionDetails = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ status: false, message: "ID is required" });

  const occasion = await OccasionType.findById(id).lean();
  if (!occasion) {
    return res.status(404).json({ status: false, message: "Occasion type not found" });
  }

  // Fetch metadata for dropdowns
  const [states, sites, species] = await Promise.all([
    State.find({ status: true }).select('state_name districts').sort({ state_name: 1 }).lean(),
    Site.find({ status: true }).select('site_name state_id district capacity planted_count native_species').sort({ site_name: 1 }).lean(),
    Species.find({ status: true }).select('name scientific_name site_id variations species_image').sort({ name: 1 }).lean()
  ]);

  return res.json({
    status: true,
    message: "Occasion details fetched",
    data: {
      ...occasion,
      metadata: {
        states: states.map(s => ({
          id: s._id,
          name: s.state_name,
          districts: s.districts
        })),
        projects: sites.map(s => ({
          id: s._id,
          name: s.site_name,
          state_id: s.state_id,
          district: s.district,
          remaining_trees: s.capacity === -1 ? "Unlimited" : Math.max(0, s.capacity - (s.planted_count || 0)),
          native_species: s.native_species || []
        })),
        species: species.map(s => ({
          id: s._id,
          name: s.name,
          scientific_name: s.scientific_name,
          project_id: s.site_id,
          variations: s.variations || [],
          image: s.species_image
        }))
      }
    }
  });
});
