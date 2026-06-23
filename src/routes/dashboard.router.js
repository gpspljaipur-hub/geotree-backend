import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import { decryptionMiddleware } from "../middleware/security.middleware.js";
import * as dashboardController from "../controllers/dashboard.controller.js";

const router = express.Router();

router.post("/details", authMiddleware, decryptionMiddleware, dashboardController.getDashboardUser);
router.post("/getDashboard",  decryptionMiddleware, dashboardController.getDashboard);

export default router;