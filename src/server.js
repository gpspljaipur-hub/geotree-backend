import "dotenv/config";
// Standardize environment string to lowercase for cross-platform and cross-case comparisons
if (process.env.NODE_ENV)
  process.env.NODE_ENV = process.env.NODE_ENV.toLowerCase();
import express from "express";
import connectDB from "./config/db.js";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoSanitize from "./middleware/mongoSanitize.middleware.js";
import cors from "cors";
import errorHandler from "./middleware/error.middleware.js";

import adminRoutes from "./routes/admin.routes.js";
import adminUiRoutes from "./routes/admin.ui.routes.js";
import authRoutes from "./routes/auth.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import carbonRoutes from "./routes/carbon.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import certificateRoutes from "./routes/certificate.routes.js";

import iplRoutes from "./routes/ipl.routes.js";
import masterRoutes from "./routes/master.routes.js";
import monitoringRoutes from "./routes/monitoring.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import plantationRoutes from "./routes/plantation.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import reportRoutes from "./routes/report.routes.js";
import speciesRoutes from "./routes/species.routes.js";
import stateRoutes from "./routes/state.routes.js";
import verificationRoutes from "./routes/verification.routes.js";
import siteInventoryRoutes from "./routes/siteInventory.routes.js";
import certificateTemplateRoutes from "./routes/certificateTemplate.routes.js";
import locationDataRoutes from "./routes/locationData.routes.js";
import occasionRoutes from "./routes/occasion.routes.js";
import siteRoutes from "./routes/site.routes.js";
import legalRoutes from "./routes/legal.routes.js";
import dashboardRoutes from "./routes/dashboard.router.js";
import seedAdmin from "./scripts/seedAdmin.js";
// import { startIPLCron } from "./cron/ipl.cron.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment configuration is handled by import "dotenv/config" at the top

mongoose.set("bufferCommands", false);

const app = express();

// ==========================================
// � High Performance & Scaling Config
// ==========================================
// Trust the Load Balancer/Reverse Proxy (AWS, Nginx, Cloudflare)
// This ensures Rate Limiting uses the REAL user IP, not the Proxy IP.
app.set("trust proxy", 1);

// ==========================================
// �🛡️ Security & Performance Middleware
// ==========================================

// 0. Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev")); // Detailed logs for development
} else {
  app.use(morgan("combined")); // Standard Apache combined log for production
}

// 1. HTTP Headers Security
// CSP must allow the actual origin (IP or hostname), not just hardcoded localhost
const PORT_NUM = process.env.PORT || 5030;
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://apis.google.com",
          "https://cdn.tailwindcss.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline onchange, onclick etc.
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.tailwindcss.com",
        ],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "http:", "https:"],
        frameAncestors: ["'self'", "http:", "https:"],
      },
    },
    xFrameOptions: false,
  }),
);

// 2. CORS Configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // In development, allow ANY origin
      if (process.env.NODE_ENV?.toLowerCase() === "development") {
        return callback(null, true);
      }

      // FIX: In production, FAIL CLOSED if no whitelist is configured.
      // Previously this silently allowed all origins — a security risk.
      if (allowedOrigins.length === 0) {
        console.error(
          "⚠️  CORS_ORIGIN is not set in production — all cross-origin requests blocked.",
        );
        return callback(
          new Error("CORS not configured. Contact the server administrator."),
        );
      }

      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "Content-Length",
      "lang",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

// 3. Data Sanitization (Applied after body parsing below)

// Rate Limiting is currently DISABLED.
// To re-enable, uncomment all blocks below and test gradually.
// Auth routes: very tight (10 requests per 15 minutes per IP)
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   message: { status: false, message: 'Too many authentication attempts. Please try again after 15 minutes.' },
//   standardHeaders: true,
//   legacyHeaders: false
// });

// General API routes (100 per minute per IP)
// const apiLimiter = rateLimit({
//   windowMs: 1 * 60 * 1000,
//   max: process.env.NODE_ENV?.toLowerCase() === 'production' ? 100 : 1000,
//   message: { status: false, message: 'Too many requests from this IP, please try again later.' },
//   standardHeaders: true,
//   legacyHeaders: false,
//   skip: (req) => req.path === '/api/health' || req.path === '/'
// });

// 5. Compression (Gzip)
app.use(compression());

// 6. Logging (Moved to top)

// Body parsing: URL encoded & JSON
// Increased limits to allow base64 profile image uploads
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Data Sanitization against NoSQL Query Injection
app.use(mongoSanitize);

// Ensure public/uploads and subdirectories exist
const uploadBase = path.join(__dirname, "../public/uploads");
const subDirs = ["profile", "state", "category", "occasion", "species"];

[uploadBase, ...subDirs.map((d) => path.join(uploadBase, d))].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📂 Created directory: ${dir}`);
  }
});

// Apply CORS specifically to static assets to ensure external clients can read images
app.use(
  "/uploads",
  cors(),
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(uploadBase),
);

// Serve generated occasion HTML forms — accessible via GET /forms/occasion-<id>.html
const formsDir = path.join(__dirname, "../public/forms");
if (!fs.existsSync(formsDir)) fs.mkdirSync(formsDir, { recursive: true });
app.use("/forms", cors(), express.static(formsDir));
app.use(express.static(path.join(__dirname, "../public")));

// Serve public directory for static HTML pages
app.use(express.static(path.join(__dirname, "../public")));

const startServer = async () => {
  try {
    await connectDB();

    // Seed Super Admin on startup
    await seedAdmin();

    // ── Rate Limiters (currently DISABLED — uncomment to re-enable) ──────────
    // app.use("/api/auth", authLimiter, authRoutes);
    // app.use("/api/", apiLimiter);
    app.use("/api/auth", authRoutes);

    app.use("/api/admin", adminRoutes);
    app.use("/api/admin-ui", adminUiRoutes);
    app.use("/api/audit", auditRoutes);
    app.use("/api/carbon", carbonRoutes);
    app.use("/api/category", categoryRoutes);
    app.use("/api/certificate", certificateRoutes);

    app.use("/api/ipl", iplRoutes);
    app.use("/api/master", masterRoutes);
    app.use("/api/monitoring", monitoringRoutes);
    app.use("/api/orders", orderRoutes);
    app.use("/api/payment", paymentRoutes);
    app.use("/api/plantation", plantationRoutes);
    app.use("/api/profile", profileRoutes);
    app.use("/api/reports", reportRoutes);
    app.use("/api/species", speciesRoutes);
    app.use("/api/state", stateRoutes);
    app.use("/api/verification", verificationRoutes);
    app.use("/api/site-inventory", siteInventoryRoutes);
    app.use("/api/certificate-templates", certificateTemplateRoutes);
    app.use("/api/location-data", locationDataRoutes);
    app.use("/api/occasion", occasionRoutes);
    app.use("/api/site", siteRoutes);
    app.use("/api/legal", legalRoutes);
    //
    app.use("/api/dashboard", dashboardRoutes);

    app.get("/", (req, res) => {
      res.send("<h1>GeoTree Backend API is Running 🌳</h1>");
    });

    app.get("/api/health", (req, res) => {
      res.json({
        status: true, // consistent with rest of API (was 'success' — fixed)
        message: "API is healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      });
    });

    // 404 Handler
    app.use((req, res) => {
      res.status(404).json({
        status: false,
        message: `Route not found - ${req.originalUrl}`,
      });
    });

    // Global Error Handler
    app.use(errorHandler);

    const PORT = 5030;
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on PORT==== ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/`);
      console.log(`📍 API Health: http://localhost:${PORT}/api/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    });

    // ==========================================
    // Graceful Shutdown Handlers
    // ==========================================
    const gracefulShutdown = async (signal) => {
      console.log(`\n⚠️  ${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        console.log("✅ HTTP server closed");

        try {
          await mongoose.connection.close();
          console.log("✅ Database connection closed");
          console.log("👋 Graceful shutdown completed");
          process.exit(0);
        } catch (error) {
          console.error("❌ Error during shutdown:", error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error("⚠️  Forced shutdown after timeout");
        process.exit(1);
      }, 30000);
    };

    // Handle termination signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("❌ Uncaught Exception:", error);
      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
      gracefulShutdown("UNHANDLED_REJECTION");
    });
  } catch (error) {
    console.error("Startup failed ❌", error.message);
    process.exit(1);
  }
};

startServer();
