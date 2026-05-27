import express from "express";
import * as controller from "../controllers/siteInventory.controller.js";
import auth from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @desc Public/App/Admin to get specific site summary
 */
router.post("/summary", controller.getSiteInventorySummary);

/**
 * @desc Admin only to get all inventories
 */
router.post("/list", auth, controller.getAllInventories);

/**
 * @desc Admin/Field only to update physical planted count
 */
router.post("/update-planted", auth, controller.updateInventoryPlantedCount);

export default router;
