import "dotenv/config";
import mongoose from "mongoose";
import Plantation from "../models/plantation.model.js";
import SiteInventory from "../models/siteInventory.model.js";
import connectDB from "../config/db.js";

const backfillInventory = async () => {
    try {
        await connectDB();
        console.log("Connected to database for backfilling inventory...");

        // Clear existing inventory to start fresh (optional, but safer for sync)
        // await SiteInventory.deleteMany({});
        // console.log("Cleared existing inventory.");

        const plantations = await Plantation.find({ site_id: { $ne: null } }).lean();
        console.log(`Processing ${plantations.length} plantations...`);

        const inventoryMap = {}; // Key: site_id:species_id:height

        for (const p of plantations) {
            if (!p.site_id || !p.plants || !p.plants.length) continue;

            for (const plant of p.plants) {
                const key = `${p.site_id}:${plant.plant_id}:${plant.tree_height || ""}`;
                if (!inventoryMap[key]) {
                    inventoryMap[key] = {
                        site_id: p.site_id,
                        species_id: plant.plant_id,
                        tree_height: plant.tree_height || "",
                        ordered_count: 0,
                        planted_count: 0
                    };
                }
                inventoryMap[key].ordered_count += Number(plant.quantity) || 0;
            }

            // If the plantation is already fully/partially planted, reflect that in planted_count too?
            // Based on the user request, 'how much are planted' might come from physical updates.
            // But if we have historical data of planted_count in Plantation, we could use it.
            // However, Plantation.planted_count is a total, not species-level.
            // So physical planting MUST be updated via the new API.
        }

        const ops = Object.values(inventoryMap).map(item => ({
            updateOne: {
                filter: {
                    site_id: item.site_id,
                    species_id: item.species_id,
                    tree_height: item.tree_height
                },
                update: { $set: { ordered_count: item.ordered_count } },
                upsert: true
            }
        }));

        if (ops.length > 0) {
            await SiteInventory.bulkWrite(ops);
            console.log(`Success: Backfilled ${ops.length} inventory entries.`);
        } else {
            console.log("No inventory entries to backfill.");
        }

        mongoose.connection.close();
    } catch (err) {
        console.error("Backfill failed:", err.message);
        process.exit(1);
    }
};

backfillInventory();
