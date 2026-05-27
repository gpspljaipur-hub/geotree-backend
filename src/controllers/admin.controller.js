import Admin from "../models/admin.model.js";
import User from "../models/user.model.js";
import Order from "../models/order.model.js";
import Transaction from "../models/transaction.model.js";
import Carbon from "../models/carbon.model.js";
import Match from "../models/match.model.js";
import Certificate from "../models/certificate.model.js";
import Nursery from "../models/nursery.model.js";
import Plantation from "../models/plantation.model.js";
import bcrypt from "bcrypt";
import asyncHandler from "../utils/asyncHandler.js";
import { getRequestParams, parseBoolean } from "../utils/request.util.js";
import { deleteFile } from "../utils/file.util.js";
import RolePermission from "../models/rolePermission.model.js";

// @desc    Get permissions list
export const getPermissions = asyncHandler(async (req, res) => {
    let roles = await RolePermission.find({}).lean();

    // Initialize Super Admin if not present
    if (roles.length === 0) {
        const superAdmin = await RolePermission.create({
            role_name: 'super_admin',
            display_name: 'Super Admin',
            theme_color: '#E73895',
            icon: 'ShieldCheck',
            description: 'Full system access',
            permissions: ["*"]
        });
        const financeAdmin = await RolePermission.create({
            role_name: 'finance',
            display_name: 'Finance Admin',
            theme_color: '#3B82F6',
            icon: 'Banknotes',
            description: 'Manages payments and refunds',
            permissions: ["/finance", "/reports"]
        });
        const fieldOfficer = await RolePermission.create({
            role_name: 'field',
            display_name: 'Field Officer',
            theme_color: '#10B981',
            icon: 'MapPin',
            description: 'Manages sites and plantations',
            permissions: ["/inventory", "/sites"]
        });
        roles = [superAdmin, financeAdmin, fieldOfficer].map(r => r.toObject());
    }

    const permissionsMap = {};
    roles.forEach(r => {
        permissionsMap[r.display_name || r.role_name] = r.permissions;
    });

    const available_routes = [
        { path: "/users", label: "User Management" },
        { path: "/orders", label: "Order Management" },
        { path: "/finance", label: "Finance & Payments" },
        { path: "/reports", label: "Reports & Analytics" },
        { path: "/inventory", label: "Site Inventory" },
        { path: "/certificates", label: "Certificates" },
        { path: "/settings", label: "System Settings" },
        { path: "/locations", label: "Locations" },
        { path: "/profile", label: "Admin Profile" },
        { path: "/dashboard", label: "Dashboard" }
    ];

    res.status(200).json({
        status: true,
        message: "Permissions fetched successfully",
        data: {
            permissions: permissionsMap,
            available_routes
        }
    });
});

// @desc    Update permissions list
export const updatePermissions = asyncHandler(async (req, res) => {
    let rawPermissions = req.body.permissions || req.body.data;

    if (!rawPermissions) {
        return res.status(400).json({ status: false, message: "Permissions data is required" });
    }

    // Since the system rejects application/json and forces URL-encoded,
    // the permissions object will come as a stringified JSON.
    let parsedPermissions;
    if (typeof rawPermissions === 'string') {
        try {
            parsedPermissions = JSON.parse(rawPermissions);
        } catch (error) {
            return res.status(400).json({ status: false, message: "Invalid JSON format for permissions" });
        }
    } else {
        parsedPermissions = rawPermissions;
    }

    if (typeof parsedPermissions !== 'object' || Array.isArray(parsedPermissions)) {
        return res.status(400).json({ status: false, message: "Invalid payload format. Expected an object mapping roles to array of routes." });
    }

    for (const [roleName, permissions] of Object.entries(parsedPermissions)) {
        if (roleName.toLowerCase() === 'super_admin' || roleName === 'Super Admin') {
            continue; // Prevent lock out
        }
        await RolePermission.findOneAndUpdate(
            { $or: [{ role_name: roleName }, { display_name: roleName }] },
            {
                $set: {
                    permissions: Array.isArray(permissions) ? permissions : [],
                    display_name: roleName
                },
                $setOnInsert: { role_name: roleName.toLowerCase().replace(/\s+/g, '_') }
            },
            { upsert: true, new: true }
        );
    }

    res.status(200).json({ status: true, message: "Permissions updated successfully" });
});

// @desc    Get Roles Metadata
export const getRolesMetadata = asyncHandler(async (req, res) => {
    const roles = await RolePermission.find({}).select('role_name display_name theme_color icon description').lean();

    if (roles.length === 0) {
        return res.status(200).json({
            status: true,
            data: [
                { role: "Super Admin", theme_color: "#E73895", icon: "ShieldCheck", description: "Full system access" },
                { role: "Finance Admin", theme_color: "#3B82F6", icon: "Banknotes", description: "Manages payments and refunds" },
                { role: "Field Officer", theme_color: "#10B981", icon: "MapPin", description: "Manages sites and plantations" }
            ]
        });
    }

    const mappedRoles = roles.map(r => ({
        role: r.display_name || r.role_name,
        theme_color: r.theme_color,
        icon: r.icon,
        description: r.description
    }));

    res.status(200).json({
        status: true,
        message: "Roles metadata fetched successfully",
        data: mappedRoles
    });
});
// @desc    List all admins
export const getAllAdmins = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 10 } = getRequestParams(req, ['status', 'page', 'limit']);
    const filter = {};
    if (status !== undefined) {
        filter.status = parseBoolean(status);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [admins, total] = await Promise.all([
        Admin.find(filter).select('-password_hash').sort({ created_at: -1 }).skip(skip).limit(Number(limit)).lean(),
        Admin.countDocuments(filter)
    ]);

    res.status(200).json({
        status: true,
        message: "Admins list fetched successfully",
        data: admins,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
        }
    });
});

// @desc    Add new admin user
export const addAdmin = asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ status: false, message: "Missing required fields" });
    }

    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
        return res.status(400).json({ status: false, message: "Email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const newAdmin = await Admin.create({
        name,
        email: email.toLowerCase(),
        password_hash: hash,
        role,
        image: req.file ? `/uploads/admins/${req.file.filename}` : undefined
    });

    const response = newAdmin.toObject();
    delete response.password_hash;

    res.status(201).json({
        status: true,
        message: "Admin added successfully",
        data: response
    });
});

// @desc    Update admin user
export const updateAdmin = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    const { name, role, status, password, image } = req.body;
    if (!id) return res.status(400).json({ status: false, message: "Admin ID required" });

    const updateSet = {};
    if (name) updateSet.name = name;
    if (role) updateSet.role = role;
    if (status !== undefined) updateSet.status = parseBoolean(status);

    // Process optional password change
    if (password && password.trim() !== '') {
        const salt = await bcrypt.genSalt(10);
        updateSet.password_hash = await bcrypt.hash(password, salt);
    }

    // Process potential image replacement or deletion
    if (req.file) {
        const admin = await Admin.findById(id);
        if (admin && admin.image) deleteFile(admin.image);
        updateSet.image = `/uploads/admins/${req.file.filename}`;
    } else if (image === '' || image === 'null') {
        const admin = await Admin.findById(id);
        if (admin && admin.image) deleteFile(admin.image);
        updateSet.image = null;
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
        id,
        { $set: updateSet },
        { new: true, runValidators: true }
    ).select('-password_hash').lean();

    if (!updatedAdmin) {
        return res.status(404).json({ status: false, message: "Admin not found" });
    }

    res.status(200).json({
        status: true,
        message: "Admin updated successfully",
        data: updatedAdmin
    });
});

// @desc    Master Dashboard Stats
export const getDashboardStats = asyncHandler(async (req, res) => {
    const allowedRoles = ['super_admin', 'admin', 'finance'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ status: false, message: "Unauthorized dashboard access" });
    }

    const [
        totalUsers,
        totalOrdersCount,
        pendingOrders,
        completedOrders,
        treesPlantedData,
        revenueData,
        carbonData,
        iplTreesData,
        totalCertificates,
        activeSites,
        iplDotBallsData,
        nurseryStockData
    ] = await Promise.all([
        User.countDocuments({}),
        Order.countDocuments({}),
        Order.countDocuments({ order_status: { $in: ['Pending', 'Assigned', 'Executed', 'Verified'] } }),
        Order.countDocuments({ order_status: 'Completed' }),
        Order.aggregate([
            { $match: { order_status: 'Completed' } },
            { $group: { _id: null, total: { $sum: "$trees_count" } } }
        ]),
        Transaction.aggregate([
            { $match: { status: 'Completed' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        Carbon.aggregate([
            { $group: { _id: null, total: { $sum: "$total" } } }
        ]),
        Match.aggregate([
            { $group: { _id: null, total: { $sum: { $add: ["$team1_trees", "$team2_trees"] } } } }
        ]),
        Certificate.countDocuments({}),
        Nursery.countDocuments({}),
        Match.aggregate([
            { $group: { _id: null, total: { $sum: "$match_dot_balls" } } }
        ]),
        Nursery.aggregate([
            { $unwind: "$stock" },
            { $group: { _id: null, total: { $sum: "$stock.count" } } }
        ])
    ]);

    const orderTrees = treesPlantedData[0]?.total || 0;
    const iplTrees = iplTreesData[0]?.total || 0;
    const totalCarbonKg = carbonData[0]?.total || 0;
    const iplDotBalls = iplDotBallsData[0]?.total || 0;
    const nurseryStock = nurseryStockData[0]?.total || 0;
    const totalRev = revenueData[0]?.total || 0;

    res.status(200).json({
        status: true,
        message: "Dashboard stats fetched successfully",
        data: {
            users: { total: totalUsers },
            orders: {
                total: totalOrdersCount,
                pending: pendingOrders,
                completed: completedOrders
            },
            impact: {
                trees_planted: orderTrees + iplTrees,
                carbon_offset_kg: totalCarbonKg,
                carbon_offset_tonnes: (totalCarbonKg / 1000).toFixed(2),
                state_wise: await Plantation.aggregate([
                    { $match: { payment_status: 'Completed' } },
                    { $group: { _id: "$state_name", trees: { $sum: "$trees_count" }, carbon: { $sum: { $multiply: ["$trees_count", 20] } } } },
                    { $project: { state: "$_id", trees: 1, carbon: 1, _id: 0 } },
                    { $sort: { carbon: -1 } }
                ])
            },
            finance: {
                total_revenue: totalRev
            },
            certificate: {
                total: totalCertificates
            },
            active_sites: {
                total: activeSites
            },
            ipl: {
                dot_balls: iplDotBalls
            },
            nursery: {
                stock_summary: nurseryStock
            }
        }
    });
});

// @desc    Get Current Admin Profile
export const getProfile = asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.user.id).select('-password_hash').lean();
    if (!admin) return res.status(404).json({ status: false, message: "Admin not found" });

    res.status(200).json({
        status: true,
        message: "Admin profile fetched",
        data: admin
    });
});

// @desc    Update Password
export const updatePassword = asyncHandler(async (req, res) => {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) return res.status(400).json({ status: false, message: "Old and new password required" });

    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ status: false, message: "Admin not found" });

    const isMatch = await bcrypt.compare(old_password, admin.password_hash);
    if (!isMatch) return res.status(400).json({ status: false, message: "Incorrect old password" });

    const salt = await bcrypt.genSalt(10);
    admin.password_hash = await bcrypt.hash(new_password, salt);
    await admin.save();

    res.status(200).json({ status: true, message: "Password updated successfully" });
});

// @desc    List all regular users
export const getAllUsers = asyncHandler(async (req, res) => {
    const { status, search, page = 1, limit = 10 } = getRequestParams(req, ['status', 'search', 'page', 'limit']);

    const filter = {};
    if (status !== undefined) filter.status = parseBoolean(status);

    if (search) {
        const specs = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
        if (!isNaN(search) && search.trim() !== '') specs.push({ mobile: Number(search) });
        filter.$or = specs;
    }

    const users = await User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean();

    const total = await User.countDocuments(filter);

    res.status(200).json({
        status: true,
        message: "Users list fetched",
        data: users.map(u => {
            const { password, otp, token, device_token, ...safeUser } = u;
            return {
                id: u._id,
                name: u.name || null,
                email: u.email || null,
                mobile: u.mobile || null,
                username: u.username || null,
                profile_image: u.profile_image || null,
                carbon_footprint: u.carbon_footprint || 0,
                status: u.status,
                last_login: u.last_login || null,
                ...safeUser,
                created_at: u.createdAt || u.created_at
            };
        }),
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit))
        }
    });
});

// @desc    Update regular user
export const updateUser = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (!id) return res.status(400).json({ status: false, message: "User ID required" });

    const { name, email, status, carbon_footprint } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ status: false, message: "User not found" });

    const updateSet = {};
    if (name) updateSet.name = name;
    if (email) updateSet.email = email;
    if (status !== undefined) updateSet.status = parseBoolean(status);
    if (carbon_footprint !== undefined) updateSet.carbon_footprint = Number(carbon_footprint);

    if (req.file) {
        if (user.profile_image) deleteFile(user.profile_image);
        updateSet.profile_image = `/uploads/profile/${req.file.filename}`;
    } else if (req.body.profile_image === '' || req.body.profile_image === 'null') {
        if (user.profile_image) deleteFile(user.profile_image);
        updateSet.profile_image = null;
    }

    const updatedUser = await User.findByIdAndUpdate(id, { $set: updateSet }, { new: true, runValidators: true }).lean();

    if (!updatedUser) return res.status(404).json({ status: false, message: "User not found" });

    const { password, otp, token, device_token, ...safeUser } = updatedUser;

    res.status(200).json({
        status: true,
        message: "User updated successfully",
        data: {
            id: updatedUser._id,
            name: updatedUser.name || null,
            email: updatedUser.email || null,
            mobile: updatedUser.mobile || null,
            username: updatedUser.username || null,
            profile_image: updatedUser.profile_image || null,
            carbon_footprint: updatedUser.carbon_footprint || 0,
            status: updatedUser.status,
            last_login: updatedUser.last_login || null,
            ...safeUser,
            created_at: updatedUser.createdAt || updatedUser.created_at
        }
    });
});

// @desc    Delete admin user
export const deleteAdmin = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    if (id === req.user.id) return res.status(400).json({ status: false, message: "You cannot delete yourself" });

    const admin = await Admin.findByIdAndDelete(id);
    if (!admin) return res.status(404).json({ status: false, message: "Admin not found" });

    res.status(200).json({ status: true, message: "Admin deleted" });
});

// @desc    Delete regular user
export const deleteUser = asyncHandler(async (req, res) => {
    const id = req.body.id || req.query.id || req.params.id;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ status: false, message: "User not found" });
    res.status(200).json({ status: true, message: "User deleted" });
});
