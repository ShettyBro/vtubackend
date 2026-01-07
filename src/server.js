import app from "./app.js";
import env from "./config/env.js";

const server = app.listen(env.port, () => {
  console.log("🚀 VTU Fest Backend running");
  console.log("🌍 Env:", env.env);
  console.log("🔌 Port:", env.port);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down.");
  server.close(() => process.exit(0));
});
