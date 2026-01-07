import dotenv from "dotenv";

dotenv.config();

const requiredVars = [
  "DB_SERVER",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET"
];

requiredVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

export default {
  env: process.env.NODE_ENV || "production",
  port: process.env.PORT || 8080,
  db: {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiryHours: Number(process.env.JWT_EXPIRY_HOURS || 4)
  },
  timezone: process.env.TIMEZONE || "Asia/Kolkata"
};
