import express from "express";
import cors from "cors";

import requestId from "./middleware/requestId.js";
import errorHandler from "./middleware/error.middleware.js";

import studentRoutes from "./modules/students/students.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";

const app = express();

/**
 * Global middlewares
 */
app.use(cors());
app.use(express.json());
app.use(requestId);

/**
 * Health check
 * MUST NOT touch DB / Blob
 */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    time: new Date().toISOString(),
    requestId: req.requestId
  });
});

/**
 * Routes
 */
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);

/**
 * Root
 */
app.get("/", (req, res) => {
  res.json({ message: "VTU Fest Backend API is running" });
});

/**
 * Error handler MUST be last
 */
app.use(errorHandler);

export default app;
