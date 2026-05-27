import CertificateTemplate from "../models/certificateTemplate.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { deleteFile } from "../utils/file.util.js";
import fs from 'fs';

/**
 * GET | /template/list
 * List all certificate templates with pagination and optional filters.
 */
export const getTemplateList = asyncHandler(async (req, res) => {
    const { status, type, page = 1, limit = 10, search } = { ...req.query, ...req.body };
    const filter = {};

    if (status !== undefined) {
        filter.status = (status === 'true' || status === true);
    }
    if (type) {
        filter.type = type;
    }
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { title: { $regex: search, $options: 'i' } }
        ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [templates, total] = await Promise.all([
        CertificateTemplate.find(filter)
            .select('-html_template') // Exclude heavy field from list for performance
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
        CertificateTemplate.countDocuments(filter)
    ]);

    res.json({
        status: true,
        message: "Templates fetched successfully",
        data: templates,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
        }
    });
});

/**
 * GET | /template/get/:id
 * Fetch a single template by ID.
 */
export const getTemplateById = asyncHandler(async (req, res) => {
    const id = req.params.id || req.body.id || req.query.id;
    if (!id) throw new ApiError(400, "Template ID (+id) is required");

    const template = await CertificateTemplate.findById(id).lean();
    if (!template) throw new ApiError(404, "Template not found");

    res.json({
        status: true,
        message: "Template details fetched",
        data: template
    });
});

/**
 * POST | /template/add
 * Add a new certificate template.
 */
export const addTemplate = asyncHandler(async (req, res) => {
    const {
        name,
        type,
        primaryColor,
        title,
        subTitle,
        description,
        tagline,
        html_template,
        status
    } = req.body;

    let previewImage = req.body.previewImage || null;
    let final_html_template = html_template;

    if (req.files) {
        // Image aliases
        const imgFile = req.files.previewImage?.[0] || req.files.background_image?.[0];
        if (imgFile) {
            previewImage = `/uploads/template/${imgFile.filename}`;
        }
        // HTML file aliases
        const htmlFile = req.files.template_file?.[0] || req.files.html_template?.[0];
        if (htmlFile) {
            final_html_template = `/uploads/template/${htmlFile.filename}`;
        }
    }

    if (!name || !type || !primaryColor || !title || !subTitle || !description || !tagline || !final_html_template) {
        if (req.files?.previewImage?.[0]) deleteFile(`/uploads/template/${req.files.previewImage[0].filename}`);
        throw new ApiError(400, "All fields are required (including html_template or template_file)");
    }

    const existing = await CertificateTemplate.findOne({ name });
    if (existing) {
        if (req.files?.previewImage?.[0]) deleteFile(`/uploads/template/${req.files.previewImage[0].filename}`);
        throw new ApiError(400, "Template with this name already exists");
    }

    const newTemplate = await CertificateTemplate.create({
        name,
        type,
        primaryColor,
        previewImage,
        title,
        subTitle,
        description,
        tagline,
        html_template: final_html_template,
        status: status !== undefined ? (status === 'true' || status === true) : true
    });

    res.status(201).json({
        status: true,
        message: "Template created successfully",
        data: newTemplate
    });
});

/**
 * POST | /template/update
 * Update an existing certificate template.
 */
export const updateTemplate = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    const {
        name,
        type,
        primaryColor,
        title,
        subTitle,
        description,
        tagline,
        html_template,
        status
    } = req.body;

    if (!id) throw new ApiError(400, "Template ID (+id) is required");

    const template = await CertificateTemplate.findById(id);
    if (!template) throw new ApiError(404, "Template not found");

    const updateData = {};
    if (name) updateData.name = name;
    if (type) updateData.type = type;
    if (primaryColor) updateData.primaryColor = primaryColor;
    if (title) updateData.title = title;
    if (subTitle) updateData.subTitle = subTitle;
    if (description) updateData.description = description;
    if (tagline) updateData.tagline = tagline;
    if (html_template) updateData.html_template = html_template;
    if (status !== undefined) updateData.status = (status === 'true' || status === true);

    if (req.files) {
        // Image aliases
        const imgFile = req.files.previewImage?.[0] || req.files.background_image?.[0];
        if (imgFile) {
            updateData.previewImage = `/uploads/template/${imgFile.filename}`;
            if (template.previewImage) deleteFile(template.previewImage);
        }
        // HTML file aliases
        const htmlFile = req.files.template_file?.[0] || req.files.html_template?.[0];
        if (htmlFile) {
            updateData.html_template = `/uploads/template/${htmlFile.filename}`;
            if (template.html_template) deleteFile(template.html_template);
        }
    } else if (req.body.previewImage) {
        updateData.previewImage = req.body.previewImage;
    }

    const updated = await CertificateTemplate.findByIdAndUpdate(id, updateData, { new: true }).lean();

    res.json({
        status: true,
        message: "Template updated successfully",
        data: updated
    });
});

/**
 * POST | /template/delete
 * Delete a certificate template.
 */
export const deleteTemplate = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) throw new ApiError(400, "Template ID (+id) is required");

    const template = await CertificateTemplate.findByIdAndDelete(id);
    if (!template) throw new ApiError(404, "Template not found");

    // Clean up files
    if (template.previewImage) deleteFile(template.previewImage);
    if (template.html_template) deleteFile(template.html_template);

    res.json({
        status: true,
        message: "Template deleted successfully"
    });
});
