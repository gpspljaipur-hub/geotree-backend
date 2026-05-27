import SiteInventory from "../models/siteInventory.model.js";
import Site from "../models/site.model.js";
import Species from "../models/species.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { getRequestParams } from "../utils/request.util.js";
import { translateData } from "../utils/translation.util.js";

/**
 * @desc Get Site Inventory Summary
 * @route POST /api/site-inventory/summary
 */
export const getSiteInventorySummary = asyncHandler(async (req, res) => {
    const { site_id, lang = 'en' } = getRequestParams(req, ['site_id', 'lang']);
    if (!site_id) throw new ApiError(400, "site_id is required");

    // Fetch site with state in one parallel check
    const site = await Site.findById(site_id)
        .select('site_name lat lng district state_id capacity')
        .populate('state_id', 'state_name')
        .lean();

    if (!site) throw new ApiError(404, "Site not found");

    // Using aggregation for grouping and stats calculation at DB level
    const inventory = await SiteInventory.aggregate([
        { $match: { site_id: new mongoose.Types.ObjectId(site_id) } },
        {
            $lookup: {
                from: "species",
                localField: "species_id",
                foreignField: "_id",
                as: "species"
            }
        },
        { $unwind: "$species" },
        { $sort: { "species.name": 1, tree_height: 1 } },
        {
            $group: {
                _id: "$species_id",
                species_name: { $first: "$species.name" },
                species_image: { $first: "$species.species_image" },
                variations: {
                    $push: {
                        tree_height: "$tree_height",
                        ordered_count: "$ordered_count",
                        planted_count: "$planted_count",
                        remaining_count: { $max: [0, { $subtract: ["$ordered_count", "$planted_count"] }] },
                        updated_at: "$updatedAt"
                    }
                },
                species_total_ordered: { $sum: "$ordered_count" },
                species_total_planted: { $sum: "$planted_count" }
            }
        },
        {
            $project: {
                _id: 1,
                species_name: 1,
                species_image: 1,
                variations: 1,
                species_total_ordered: 1,
                species_total_planted: 1,
                species_total_remaining: { $max: [0, { $subtract: ["$species_total_ordered", "$species_total_planted"] }] }
            }
        }
    ]);

    // Calculate overall stats
    const overall = inventory.reduce((acc, curr) => {
        acc.total_ordered += curr.species_total_ordered;
        acc.total_planted += curr.species_total_planted;
        return acc;
    }, { total_ordered: 0, total_planted: 0 });

    if (lang !== 'en') {
        if (site.state_id) await translateData([site.state_id], ['state_name'], lang);
        await translateData([site], ['site_name'], lang);
        await translateData(inventory, ['species_name'], lang);
    }

    res.json({
        status: true,
        message: "Site inventory fetched",
        data: {
            site_info: {
                _id: site._id,
                site_name: site.site_name,
                district: site.district,
                state_name: site.state_id?.state_name || "",
                capacity: site.capacity === -1 ? "Unlimited" : site.capacity
            },
            inventory,
            overall_stats: {
                ...overall,
                total_remaining: Math.max(0, overall.total_ordered - overall.total_planted)
            }
        }
    });
});

/**
 * @desc Update Planted Count in Inventory
 * @route POST /api/site-inventory/update-planted
 * @access Admin/Field Officer
 */
export const updateInventoryPlantedCount = asyncHandler(async (req, res) => {
    const { site_id, species_id, tree_height, planted_inc_count } = req.body;
    if (!site_id || !species_id || !tree_height) {
        throw new ApiError(400, "Missing required fields: site_id, species_id, tree_height");
    }

    const incCount = Number(planted_inc_count) || 0;

    const inventory = await SiteInventory.findOneAndUpdate(
        { site_id, species_id, tree_height },
        { $inc: { planted_count: incCount } },
        { new: true, upsert: true }
    );

    // Sync back to Site model's total planted_count if needed? 
    // Actually, Site.planted_count is typically updated during order creation/payment completion,
    // representing 'how many are paid for to be planted'. 
    // If Site.planted_count is supposed to be 'physical planting', we should sync it now.
    // The user says 'how much are left', implying 'ordered - physical planted'.
    // Let's increment Site total too if this is a physical planting update.
    if (incCount > 0) {
        await Site.findByIdAndUpdate(site_id, { $inc: { planted_count: incCount } }).catch(e => console.error("Failed to sync total site count:", e));
    }

    res.json({
        status: true,
        message: "Inventory updated",
        data: inventory
    });
});

/**
 * @desc Get All Site Inventories (Admin View)
 * @route POST /api/site-inventory/list
 */
export const getAllInventories = asyncHandler(async (req, res) => {
    const { lang = 'en', page = 1, limit = 10 } = getRequestParams(req, ['lang', 'page', 'limit']);
    const skip = (Number(page) - 1) * Number(limit);

    // Highly optimized pipeline to group by site first, then paginate sites
    const pipeline = [
        {
            $group: {
                _id: "$site_id",
                records: { $push: "$$ROOT" }
            }
        },
        { $sort: { _id: 1 } },
        { $skip: skip },
        { $limit: Number(limit) },
        {
            $lookup: {
                from: "sites",
                localField: "_id",
                foreignField: "_id",
                as: "site"
            }
        },
        { $unwind: "$site" },
        {
            $lookup: {
                from: "states",
                localField: "site.state_id",
                foreignField: "_id",
                as: "state"
            }
        },
        { $unwind: { path: "$state", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "species",
                localField: "records.species_id",
                foreignField: "_id",
                as: "species_info"
            }
        }
    ];

    const [results, totalCount] = await Promise.all([
        SiteInventory.aggregate(pipeline),
        SiteInventory.aggregate([{ $group: { _id: "$site_id" } }, { $count: "count" }])
    ]);

    const items = results.map(row => {
        const speciesMap = new Map(row.species_info.map(s => [s._id.toString(), s]));

        return {
            site_info: {
                _id: row.site._id,
                site_name: row.site.site_name,
                district: row.site.district,
                state_name: row.state?.state_name || "",
                capacity: row.site.capacity === -1 ? "Unlimited" : row.site.capacity
            },
            inventory: row.records.map(rec => {
                const sp = speciesMap.get(rec.species_id.toString());
                const ordered = Number(rec.ordered_count) || 0;
                const planted = Number(rec.planted_count) || 0;
                return {
                    species_id: rec.species_id,
                    species_name: sp?.name || "Unknown",
                    species_image: sp?.species_image,
                    tree_height: rec.tree_height,
                    ordered_count: ordered,
                    planted_count: planted,
                    remaining_count: Math.max(0, ordered - planted),
                    updated_at: rec.updatedAt
                };
            })
        };
    });

    if (lang !== 'en' && items.length > 0) {
        // Flat translation tasks
        const translationData = items.flatMap(i => [
            i.site_info,
            ...i.inventory.map(inv => ({ _id: inv.species_id, name: inv.species_name }))
        ]);
        await translateData(translationData, ['site_name', 'name', 'state_name'], lang);
    }

    res.json({
        status: true,
        message: "All inventories fetched",
        data: items,
        pagination: {
            total_sites: totalCount[0]?.count || 0,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil((totalCount[0]?.count || 0) / limit)
        }
    });
});
