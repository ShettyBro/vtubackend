import app from "./app.js";
import env from "./config/env.js";
import logger from "./config/logger.js";

const port = env.port || process.env.PORT || 3000;

const server = app.listen(port, () => {
  logger.info("Server started", {
    port,
    environment: env.env
  });
});

/**
 * Graceful shutdown for Azure
 */
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down...");
  server.close(() => process.exit(0));
});
