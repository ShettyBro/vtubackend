import express from "express";
import cors from "cors";
import requestId from "./middleware/requestId.js";
import errorHandler from "./middleware/error.middleware.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestId);

/**
 * Health check (NO DB)
 */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "VTU Fest Backend",
    time: new Date().toISOString(),
    requestId: req.requestId
  });
});

/**
 * Root
 */
app.get("/", (req, res) => {
  res.json({ message: "VTU Fest Backend API running" });
});

app.use(errorHandler);

export default app;
