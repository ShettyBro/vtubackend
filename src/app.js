import express from "express";
import cors from "cors";
import requestId from "./middleware/requestId.js";
import errorHandler from "./middleware/error.middleware.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestId);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    time: new Date().toISOString(),
    requestId: req.requestId
  });
});

app.get("/", (req, res) => {
  res.json({ message: "Fest Registration Backend Running" });
});

app.use(errorHandler);

export default app;
