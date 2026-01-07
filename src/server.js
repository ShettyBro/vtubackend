// src/server.js

import app from "./app.js";
import env from "./config/env.js";

const server = app.listen(env.port, () => {
  console.log(`🚀 VTU Fest Backend running`);
  console.log(`🌍 Environment: ${env.env}`);
  console.log(`🔌 Port: ${env.port}`);
});

// Graceful shutdown (Azure sends SIGTERM)
process.on("SIGTERM", () => {
  console.log("⚠️ SIGTERM received. Shutting down...");
  server.close(() => {
    console.log("✅ Server closed cleanly");
    process.exit(0);
  });
});
