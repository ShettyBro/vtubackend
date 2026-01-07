import express from "express";
import cors from "cors";
import requestId from "./middleware/requestId.js";
import errorHandler from "./middleware/error.middleware.js";

const app = express();

/**
 * Core middleware
 */
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(requestId);

/**
 * Health check
 * Azure keep-alive & monitoring
 */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "vtu-fest-backend",
    time: new Date().toISOString(),
    requestId: req.requestId
  });
});

/**
 * Root check
 */
app.get("/", (req, res) => {
  res.status(200).json({
    message: "VTU Fest Backend API is running"
  });
});

/**
 * Error handler MUST be last
 */
app.use(errorHandler);

export default app;
