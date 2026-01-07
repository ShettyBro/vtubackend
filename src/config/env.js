const env = {
  env: process.env.NODE_ENV || "production",
  port: Number(process.env.PORT || 8080),

  db: {
    server: process.env.DB_SERVER || null,
    database: process.env.DB_NAME || null,
    user: process.env.DB_USER || null,
    password: process.env.DB_PASSWORD || null
  },

  jwt: {
    secret: process.env.JWT_SECRET || null,
    expiryHours: Number(process.env.JWT_EXPIRY_HOURS || 4)
  },

  blob: {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || null,
    container: process.env.AZURE_STORAGE_CONTAINER || null
  },

  timezone: "Asia/Kolkata"
};

export default env;
