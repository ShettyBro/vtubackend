/**
 * VTU Fest Backend - Express Application
 * 
 * CRITICAL: NO database or blob connections are established here
 * Connections are lazy-loaded when first API call requires them
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Middleware
const requestIdMiddleware = require('./middleware/requestId.middleware');
const errorHandler = require('./middleware/error.middleware');

// Routes - WITH DEBUG LOGGING
console.log('[DEBUG] Loading students routes from: ./modules/students/students.routes');
const studentsRoutes = require('./modules/students/students.routes');
console.log('[DEBUG] studentsRoutes type:', typeof studentsRoutes);
console.log('[DEBUG] studentsRoutes is function?:', typeof studentsRoutes === 'function');
console.log('[DEBUG] studentsRoutes value:', studentsRoutes);

const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// ============================================
// BODY PARSING MIDDLEWARE
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// CUSTOM MIDDLEWARE
// ============================================

app.use(requestIdMiddleware);

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'VTU Fest Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// API ROUTES
// ============================================

console.log('[DEBUG] About to register /api/students route...');
if (!studentsRoutes) {
  console.error('[ERROR] studentsRoutes is undefined!');
  throw new Error('studentsRoutes module failed to load');
}

app.use('/api/students', studentsRoutes);
console.log('[DEBUG] Successfully registered /api/students route');

// ============================================
// 404 HANDLER
// ============================================

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    requestId: req.id
  });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================

app.use(errorHandler);

module.exports = app;