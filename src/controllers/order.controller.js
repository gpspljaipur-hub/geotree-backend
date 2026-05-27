import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import Site from '../models/site.model.js';
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { translateData } from "../utils/translation.util.js";
import { getRequestParams } from "../utils/request.util.js";

// @desc    Create Order (App Side)
export const createOrder = asyncHandler(async (req, res) => {
    const {
        type,
        plantation_site_id,
        occasion_id,
        trees_count,
        amount,
        site_id, // preferred field
        project_id, // alias for site_id
        user_id // optional for admins
    } = req.body;

    // Use token user_id by default, allow body user_id for admins creating on behalf of others
    const isAdmin = ['admin', 'super_admin'].includes(req.user?.role);
    const final_user_id = (isAdmin && user_id) ? user_id : req.user?.id;

    if (!final_user_id || !trees_count || !amount || !type) {
        throw new ApiError(400, "Missing required fields: user_id, trees_count, amount, type");
    }

    const newOrder = await Order.create({
        user_id: final_user_id,
        type,
        plantation_site_id,
        occasion_id,
        trees_count,
        amount,
        site_id: site_id || project_id,
        payment_status: 'Pending',
        order_status: 'Pending'
    });

    res.status(201).json({
        status: true,
        message: "Order created successfully",
        data: newOrder
    });
});

// @desc   Get All Orders (Admin Side)
export const getAllOrders = asyncHandler(async (req, res) => {
    const { status, payment_status, type, source, page = 1, limit = 10, lang = 'en', sort = '-created_at' } = getRequestParams(req, ['status', 'payment_status', 'type', 'source', 'page', 'limit', 'lang', 'sort']);

    const query = {};
    if (status) query.order_status = status;
    if (payment_status) query.payment_status = payment_status;
    if (type) query.type = type;
    if (source) query.source = source;

    const skip = (Number(page) - 1) * Number(limit);
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;

    let orders = await Order.find(query)
        .populate('user_id', 'full_name name email')
        .populate('plantation_site_id', 'name')
        .populate('occasion_id', 'name')
        .populate('carbon_id')
        .populate('tournament_id', 'name short_name')
        .populate('site_id', 'site_name')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .lean();

    if (lang !== 'en' && orders.length > 0) {
        // Collect sub-objects for bulk translation
        const pSites = orders.map(o => o.plantation_site_id).filter(Boolean);
        const occasions = orders.map(o => o.occasion_id).filter(Boolean);
        const sites = orders.map(o => o.site_id).filter(Boolean);

        await Promise.all([
            pSites.length > 0 ? translateData(pSites, ['name'], lang) : Promise.resolve(),
            occasions.length > 0 ? translateData(occasions, ['name'], lang) : Promise.resolve(),
            sites.length > 0 ? translateData(sites, ['site_name'], lang) : Promise.resolve()
        ]);
    }

    const total = await Order.countDocuments(query);

    res.json({
        status: true,
        message: "Orders list fetched successfully",
        data: orders,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit)
        }
    });
});

// @desc    Get Single Order
export const getOrderById = asyncHandler(async (req, res) => {
    const { id, lang = 'en' } = getRequestParams(req, ['id', 'lang']);
    if (!id) throw new ApiError(400, "Order ID is required");

    let order = await Order.findById(id)
        .populate('user_id', 'full_name name email phone mobile')
        .populate('plantation_site_id')
        .populate('occasion_id')
        .populate('carbon_id')
        .populate('tournament_id')
        .populate('site_id')
        .lean();

    if (!order) throw new ApiError(404, "Order not found");

    if (lang !== 'en') {
        const translateTasks = [];
        if (order.plantation_site_id) translateTasks.push(translateData(order.plantation_site_id, ['name'], lang));
        if (order.occasion_id) translateTasks.push(translateData(order.occasion_id, ['name'], lang));
        if (order.site_id) translateTasks.push(translateData(order.site_id, ['site_name'], lang));

        if (translateTasks.length > 0) await Promise.all(translateTasks);
    }


    res.json({
        status: true,
        message: "Order details fetched",
        data: order
    });
});

// @desc    Update Order Status (Admin/Field)
export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { id, order_status, assigned_field_team, remarks } = req.body;
    if (!id) throw new ApiError(400, "Order ID is required");

    const oldOrder = await Order.findById(id);
    if (!oldOrder) throw new ApiError(404, "Order not found");

    const updateData = {};
    if (order_status) updateData.order_status = order_status;
    if (assigned_field_team) updateData.assigned_field_team = assigned_field_team;
    if (remarks) updateData.remarks = remarks;

    if (order_status === 'Completed' || order_status === 'Executed') {
        updateData.execution_date = new Date();
    }

    const order = await Order.findByIdAndUpdate(id, updateData, { new: true });

    // FIX: Increment site count ONLY if transitioning TO Paid/Completed from a different state
    const wasAlreadyCounted = oldOrder.payment_status === 'Paid' || oldOrder.order_status === 'Completed';
    const isNowCounted = order.payment_status === 'Paid' || order.order_status === 'Completed';

    if (!wasAlreadyCounted && isNowCounted && order.site_id) {
        const countToAdd = Number(order.trees_count);
        await Site.findByIdAndUpdate(
            order.site_id,
            { $inc: { planted_count: countToAdd } }
        ).catch(err => console.error(`[Order Sync] Failed to update site ${order.site_id}:`, err.message));
    }

    res.json({
        status: true,
        message: "Order status updated",
        data: order
    });
});

// @desc    Get User Orders (App Side)
export const getUserOrders = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, lang = 'en' } = getRequestParams(req, ['page', 'limit', 'lang']);

    // SECURITY FIX: Never use user_id from body for non-admin users
    const isAdmin = req.user?.type === 'admin' || req.user?.role === 'admin' || req.user?.role === 'super_admin';
    const userId = (isAdmin && req.body.user_id) ? req.body.user_id : req.user?.id;

    if (!userId) throw new ApiError(400, "Authentication required");

    let orders = await Order.find({ user_id: userId })
        .populate('plantation_site_id', 'name')
        .populate('carbon_id')
        .populate('tournament_id', 'name')
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean();

    if (lang !== 'en' && orders.length > 0) {
        const pSites = orders.map(o => o.plantation_site_id).filter(Boolean);
        if (pSites.length > 0) await translateData(pSites, ['name'], lang);
    }

    const total = await Order.countDocuments({ user_id: userId });

    res.json({
        status: true,
        message: "User orders fetched successfully",
        data: orders,
        pagination: {
            total,
            page: Number(page),
            pages: Math.ceil(total / limit)
        }
    });
});

// @desc    Delete Order (Admin Side)
export const deleteOrder = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) throw new ApiError(400, "Order ID required");

    const order = await Order.findByIdAndDelete(id);
    if (!order) throw new ApiError(404, "Order not found");

    res.json({ status: true, message: "Order deleted successfully" });
});
