/**
 * Database Configuration Module
 * 
 * CRITICAL: Lazy connection pool initialization
 * - Pool is NOT created at module load time
 * - Pool is created only when first API call needs it
 * - This allows Railway health checks to pass without DB credentials
 * 
 * Railway Deployment Notes:
 * - Uses mssql library for Azure SQL Database
 * - Connection pooling configured for optimal performance
 * - Automatic reconnection on connection loss
 * 
 * FIX: Converted from ESM (import/export) to CommonJS (require/module.exports)
 */

const sql = require('mssql');
const config = require('./env');

let pool = null;

/**
 * Get or create database connection pool
 * LAZY INITIALIZATION - only connects when first called
 * 
 * @returns {Promise<sql.ConnectionPool>} MSSQL connection pool
 * @throws {Error} If database configuration is missing
 */
async function getPool() {
  // Return existing pool if already connected
  if (pool) {
    return pool;
  }

  // Validate database configuration exists
  if (!config.db.server) {
    throw new Error('Database configuration is missing. Please set DB_SERVER, DB_NAME, DB_USER, and DB_PASSWORD environment variables.');
  }

  try {
    // Create new connection pool with Azure SQL optimized settings
    pool = await sql.connect({
      user: config.db.user,
      password: config.db.password,
      server: config.db.server,
      database: config.db.database,
      options: {
        encrypt: true, // Required for Azure SQL
        trustServerCertificate: false, // Don't trust self-signed certs
        enableArithAbort: true, // Required for certain operations
        connectTimeout: 30000, // 30 seconds
        requestTimeout: 30000 // 30 seconds
      },
      pool: {
        max: 10, // Maximum pool size
        min: 0, // Minimum pool size (Railway scales down to 0)
        idleTimeoutMillis: 30000 // Close idle connections after 30s
      }
    });

    console.log('✅ Database connection pool established');
    
    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });

    return pool;
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    pool = null; // Reset pool on failure
    throw error;
  }
}

/**
 * Close database connection pool gracefully
 * Used during server shutdown (SIGTERM/SIGINT)
 * 
 * @returns {Promise<void>}
 */
async function closePool() {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      console.log('✅ Database connection pool closed');
    } catch (error) {
      console.error('❌ Error closing database pool:', error.message);
      throw error;
    }
  }
}

module.exports = {
  getPool,
  closePool,
  sql
};