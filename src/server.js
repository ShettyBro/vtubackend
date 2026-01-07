import app from "./app.js";
import env from "./config/env.js";

const PORT = env.port || process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log("🚀 VTU Fest Backend running");
  console.log("🌍 Env:", env.env);
  console.log("🔌 Port:", PORT);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down.");
  server.close(() => process.exit(0));
});
