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

// Routes
const studentsRoutes = require('./routes/students.routes');

const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet - Security headers
app.use(helmet());

// CORS - Configure based on your frontend domain
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting - Prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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

// Request ID tracking for debugging
app.use(requestIdMiddleware);

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

/**
 * Health Check - CRITICAL for Railway deployments
 * 
 * Railway pings this endpoint to verify app is running
 * NEVER add database or blob checks here - must respond instantly
 */
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

app.use('/api/students', studentsRoutes);

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