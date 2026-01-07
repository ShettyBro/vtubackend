// src/config/env.js

// NOTE:
// On Azure Linux App Service, environment variables
// are injected automatically via App Settings.
// dotenv is ONLY useful for local development.

if (process.env.NODE_ENV !== "production") {
  const dotenv = await import("dotenv");
  dotenv.config();
}

// Required environment variables
const requiredVars = [
  "DB_SERVER",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET"
];

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
}

const env = {
  env: process.env.NODE_ENV || "production",

  port: process.env.PORT || 8080,

  db: {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: true,
      trustServerCertificate: false
    }
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiryHours: Number(process.env.JWT_EXPIRY_HOURS || 4)
  },

  timezone: process.env.TIMEZONE || "Asia/Kolkata"
};

export default env;
