import express from "express";
import { getPrivacyPolicy } from "../controllers/legal.controller.js";

const router = express.Router();

router.get("/privacy-policy", getPrivacyPolicy);

export default router;
