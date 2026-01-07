/**
 * Environment Configuration
 * 
 * Railway Deployment Notes:
 * - Railway injects environment variables automatically
 * - All values have safe defaults for local development
 * - JWT_SECRET must be set in production
 * 
 * FIX: Converted from ESM (export default) to CommonJS (module.exports)
 */

const config = {
  server: {
    port: parseInt(process.env.PORT || '8080', 10),
    nodeEnv: process.env.NODE_ENV || 'production'
  },

  db: {
    server: process.env.DB_SERVER || null,
    database: process.env.DB_NAME || null,
    user: process.env.DB_USER || null,
    password: process.env.DB_PASSWORD || null
  },

  jwt: {
    secret: process.env.JWT_SECRET || null,
    expiry: process.env.JWT_EXPIRY || '4h'
  },

  blob: {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || null,
    containerName: process.env.AZURE_STORAGE_CONTAINER || 'vtufest-documents'
  },

  timezone: 'Asia/Kolkata'
};

module.exports = config;