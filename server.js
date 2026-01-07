import app from "./app.js";
import logger from "./config/logger.js";

const port = process.env.PORT || 8080;

const server = app.listen(port, () => {
  logger.info("Server started", {
    port,
    env: process.env.NODE_ENV || "production"
  });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully.");
  server.close(() => process.exit(0));
});
