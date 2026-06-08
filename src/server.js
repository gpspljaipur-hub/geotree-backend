import "dotenv/config";
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

if (process.env.NODE_ENV)
  process.env.NODE_ENV = process.env.NODE_ENV.toLowerCase();
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("JWT_SECRET:", process.env.JWT_SECRET);
// import { startIPLCron } from "./cron/ipl.cron.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

mongoose.set("bufferCommands", false);

const app = express();
app.set("trust proxy", 1);

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}
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
    // origin: (origin, callback) => {
    //   if (!origin) return callback(null, true);

    //   if (process.env.NODE_ENV?.toLowerCase() === "development") {
    //     return callback(null, true);
    //   }
    //   if (allowedOrigins.length === 0) {
    //     console.error(
    //       "⚠️  CORS_ORIGIN is not set in production — all cross-origin requests blocked.",
    //     );
    //     return callback(
    //       new Error("CORS not configured. Contact the server administrator."),
    //     );
    //   }

    //   if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
    //     return callback(null, true);
    //   }

    //   callback(new Error("Not allowed by CORS"));
    // },
    origin: true,
    credentials: true,
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
    optionsSuccessStatus: 200,
  }),
);
app.use(compression());

app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(mongoSanitize);
const uploadBase = path.join(__dirname, "../public/uploads");
const subDirs = ["profile", "state", "category", "occasion", "species"];

[uploadBase, ...subDirs.map((d) => path.join(uploadBase, d))].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📂 Created directory: ${dir}`);
  }
});
app.use(
  "/uploads",
  cors(),
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(uploadBase),
);

const formsDir = path.join(__dirname, "../public/forms");
if (!fs.existsSync(formsDir)) fs.mkdirSync(formsDir, { recursive: true });
app.use("/forms", cors(), express.static(formsDir));
app.use(express.static(path.join(__dirname, "../public")));

app.use(express.static(path.join(__dirname, "../public")));
const startServer = async () => {
  try {
    await connectDB();
    await seedAdmin();
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
