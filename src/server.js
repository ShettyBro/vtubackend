/**
 * VTU Fest Backend - Server Entry Point
 * 
 * Railway Deployment Notes:
 * - Railway injects environment variables automatically (PORT, DATABASE_URL, etc.)
 * - No dotenv required in production
 * - Server starts with: node src/server.js
 * - Health check endpoint: /api/health
 */

const app = require('./app');
const config = require('./config/env');

const PORT = config.server.port;

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   VTU Fest Backend Server Running     ║
╠════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(30)} ║
║  Env:  ${config.server.nodeEnv.padEnd(30)} ║
║  Health: /api/health                   ║
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown for Railway deployments
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close database pool if exists
    const { closePool } = require('./config/database');
    closePool()
      .then(() => {
        console.log('Database pool closed');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error closing database pool:', err);
        process.exit(1);
      });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = server;