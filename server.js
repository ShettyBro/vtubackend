import app from "./src/app.js";
import env from "./src/config/env.js";
import logger from "./src/config/logger.js";

const port = process.env.PORT || env.port || 8080;

const server = app.listen(port, () => {
  logger.info("Server started", {
    port,
    env: env.env
  });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully.");
  server.close(() => process.exit(0));
});
