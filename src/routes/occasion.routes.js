import express from "express";
const router = express.Router();
import { getOccasionDetails, getOccasionTypeList } from "../controllers/occasion.controller.js";
import { getStateList } from "../controllers/state.controller.js";
import { getSiteList } from "../controllers/site.controller.js";
import { getAll } from "../controllers/species.controller.js";

// Public routes for the standalone plantation form
router.all("/list", (req, res, next) => {
    // Force some defaults for the app list
    req.body = req.body || {};
    req.body.status = "true";
    req.body.limit = "100";
    next();
}, getOccasionTypeList);

router.get("/list/:id", getOccasionDetails);
router.get("/states", (req, res, next) => {
    // Force active only and large limit for dropdowns
    req.query.status = "true";
    req.query.limit = "100";
    next();
}, getStateList);

router.post("/projects", (req, res, next) => {
    // Map body to query if needed for existing site list logic
    req.query.state_id = req.body.state_id;
    req.query.status = "true";
    next();
}, getSiteList);

router.post("/species", (req, res, next) => {
    req.query.project_id = req.body.project_id || req.body.site_id;
    next();
}, getAll);

export default router;
