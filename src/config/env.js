import dotenv from "dotenv";

dotenv.config();

const env = {
  env: process.env.NODE_ENV || "production",
  port: process.env.PORT || 8080,

  db: {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  },

  jwt: {
    secret: process.env.JWT_SECRET || "TEMP_SECRET"
  }
};

export default env;
