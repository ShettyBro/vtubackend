/**
 * Global Error Handler Middleware
 * 
 * Catches all errors that occur in the application and formats them
 * into standardized API responses. Prevents stack traces from leaking
 * in production environments.
 * 
 * Railway Deployment Notes:
 * - Stack traces only shown in development (NODE_ENV !== 'production')
 * - All errors logged with request ID for debugging
 * - Never exposes sensitive information in error messages
 */

const config = require('../config/env');

/**
 * Custom error class for validation errors
 */
class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.errors = errors;
  }
}

/**
 * Custom error class for unauthorized access
 */
class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

/**
 * Custom error class for forbidden access
 */
class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

/**
 * Custom error class for not found resources
 */
class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

/**
 * Custom error class for conflict errors (e.g., duplicate records)
 */
class ConflictError extends Error {
  constructor(message = 'Resource already exists') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

/**
 * Global error handling middleware
 * 
 * This must be registered AFTER all routes in Express app.
 * It has 4 parameters (err, req, res, next) which signals Express
 * to treat it as error-handling middleware.
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function (unused but required)
 * @returns {Object} Express response object
 */
function errorHandler(err, req, res, next) {
  // Log error with request ID for debugging
  const requestId = req.id || 'unknown';
  console.error(`[RequestID: ${requestId}] Error occurred:`, {
    name: err.name,
    message: err.message,
    stack: config.server.nodeEnv === 'development' ? err.stack : undefined
  });

  // Default error response
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An internal server error occurred';
  let errors = err.errors || null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message || 'Validation failed';
    errors = err.errors;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = err.message || 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = err.message || 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = err.message || 'Resource not found';
  } else if (err.name === 'ConflictError') {
    statusCode = 409;
    message = err.message || 'Resource already exists';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  } else if (err.name === 'MulterError') {
    // Handle multer file upload errors
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds maximum allowed size';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    } else {
      message = err.message || 'File upload error';
    }
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    // Database or external service connection errors
    statusCode = 503;
    message = 'Service temporarily unavailable. Please try again later.';
  }

  // In production, don't expose internal error details
  if (config.server.nodeEnv === 'production' && statusCode === 500) {
    message = 'An internal server error occurred. Please try again later.';
  }

  // Build error response
  const response = {
    success: false,
    message: message,
    requestId: requestId
  };

  // Include errors array if present (validation errors)
  if (errors) {
    response.errors = Array.isArray(errors) ? errors : [errors];
  }

  // Include stack trace only in development
  if (config.server.nodeEnv === 'development' && err.stack) {
    response.stack = err.stack.split('\n');
  }

  return res.status(statusCode).json(response);
}

/**
 * 404 Not Found handler for undefined routes
 * 
 * This should be registered BEFORE the error handler but AFTER all routes.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Express response object
 */
function notFoundHandler(req, res) {
  const requestId = req.id || 'unknown';
  console.warn(`[RequestID: ${requestId}] 404 Not Found: ${req.method} ${req.originalUrl}`);

  return res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    requestId: requestId
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError
};