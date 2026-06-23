import mongoose from "mongoose";
import User from "../models/user.model.js";
import Order from "../models/order.model.js";
import Transaction from "../models/transaction.model.js";
import Carbon from "../models/carbon.model.js";
import Match from "../models/match.model.js";
import Certificate from "../models/certificate.model.js";
import Nursery from "../models/nursery.model.js";
import Plantation from "../models/plantation.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";


export const getDashboardUser = asyncHandler(async (req, res) => {

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

export const getDashboard = asyncHandler(async (req, res) => {
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


