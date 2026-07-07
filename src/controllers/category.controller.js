import Category from "../models/category.model.js";
import path from "path";
import fs from "fs";
import multer from "multer";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { translateData } from "../utils/translation.util.js";
import { getRequestParams, parseBoolean } from "../utils/request.util.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public/uploads/category');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `category-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

const multerUpload = upload.fields([
  { name: 'category_image', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]);

export const uploadCategoryImageMiddleware = (req, res, next) => {
  multerUpload(req, res, (err) => {
    if (err) return next(err);
    if (req.files) {
      const file = req.files.category_image?.[0] || req.files.image?.[0];
      if (file) {
        req.file = file;
      }
    }
    next();
  });
};

// @desc    Get category list
export const getCategoryList = asyncHandler(async (req, res) => {
  const { lang, status, page = 1, limit = 10, search, sort = 'name' } = getRequestParams(req, ['lang', 'status', 'page', 'limit', 'search', 'sort']);
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

  const filter = {};
  if (status !== undefined) {
    filter.status = parseBoolean(status);
  } else if (!isAdmin) {
    filter.status = { $ne: false };
  }

  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
  const sortOrder = sort.startsWith('-') ? -1 : 1;

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Category.countDocuments(filter)
  ]);

  let finalData = categories;
  if (lang !== 'en') {
    finalData = await translateData(finalData, ['name', 'description'], lang);
  }


  res.json({
    status: true,
    message: "Category list fetched",
    data: finalData,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    }
  });
});

// @desc    Add new category
export const addCategory = asyncHandler(async (req, res) => {
  const { name, type, description, status } = req.body;

  if (!name || !type || !description) throw new ApiError(400, "name, type, and description are required");
  if (!req.file) throw new ApiError(400, "category_image is required");

  if (!['Carbon', 'Plantation', 'Occasion','Gift', 'Sponsor'].includes(type)) {
    throw new ApiError(400, "type must be Carbon, Plantation, Occasion,Gift, or Sponsor");
  }

  try {
    const category = await Category.create({
      name,
      type,
      description,
      status: status !== undefined ? parseBoolean(status) : true,
      category_image: `/uploads/category/${req.file.filename}`
    });

    const categoryObj = category.toObject();

    res.status(201).json({ status: true, message: "Category added successfully", data: categoryObj });
  } catch (error) {
    if (req.file) {
      const filePath = path.join(process.cwd(), 'public/uploads/category', req.file.filename);
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (e) { }
    }
    throw error;
  }
});

// @desc    Update category
export const updateCategory = asyncHandler(async (req, res) => {
  const id = req.body.id || req.query.id || req.params.id;
  if (!id) throw new ApiError(400, "ID required");

  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, "Category not found");

  const { name, type, description, status } = req.body;
  const updateData = {};
  if (name) updateData.name = name;
  if (type) {
    if (!['Carbon', 'Plantation', 'Occasion', 'Sponsor'].includes(type)) {
      throw new ApiError(400, "type must be Carbon, Plantation, Occasion, or Sponsor");
    }
    updateData.type = type;
  }
  if (description) updateData.description = description;
  if (status !== undefined) updateData.status = parseBoolean(status);

  if (!req.file && (req.body.category_image === "" || req.body.category_image === "null" || req.body.category_image === null)) {
    throw new ApiError(400, "category_image is required");
  }

  if (req.file) {
    if (category.category_image) {
      const oldPath = path.join(process.cwd(), 'public', category.category_image);
      if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch (e) { }
    }
    updateData.category_image = `/uploads/category/${req.file.filename}`;
  }

  const updatedCategory = await Category.findByIdAndUpdate(id, updateData, { new: true });

  const categoryObj = updatedCategory.toObject();

  res.json({ status: true, message: "Category updated successfully", data: categoryObj });
});

// @desc    Delete category
export const deleteCategory = asyncHandler(async (req, res) => {
  const id = req.body.id || req.query.id || req.params.id;
  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, "Category not found");

  if (category.category_image) {
    const oldPath = path.join(process.cwd(), 'public', category.category_image);
    if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch (e) { }
  }

  await Category.findByIdAndDelete(id);
  res.json({ status: true, message: "Category deleted successfully" });
});
