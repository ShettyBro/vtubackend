/**
 * Response Utility Module
 * 
 * Provides standardized API response helpers for consistent response format
 * across all endpoints in the VTU Fest Registration System.
 * 
 * Standard Response Format:
 * {
 *   "success": true/false,
 *   "message": "Human readable message",
 *   "data": {...},        // Optional, present on success
 *   "errors": [...]       // Optional, present on validation failures
 * }
 */

/**
 * Send a successful response
 * 
 * @param {Object} res - Express response object
 * @param {*} data - Response data (object, array, or any JSON-serializable value)
 * @param {string} message - Success message for the user
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Express response object
 */
function successResponse(res, data = null, message = 'Success', statusCode = 200) {
  const response = {
    success: true,
    message: message
  };

  // Only include data property if data is provided
  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send an error response
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message for the user
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Array|Object} errors - Detailed error information (optional)
 * @returns {Object} Express response object
 */
function errorResponse(res, message = 'An error occurred', statusCode = 500, errors = null) {
  const response = {
    success: false,
    message: message
  };

  // Include detailed errors if provided (useful for validation errors)
  if (errors !== null && errors !== undefined) {
    // Ensure errors is always an array for consistency
    if (Array.isArray(errors)) {
      response.errors = errors;
    } else {
      response.errors = [errors];
    }
  }

  return res.status(statusCode).json(response);
}

/**
 * Send a validation error response (400)
 * Convenience wrapper for common validation failures
 * 
 * @param {Object} res - Express response object
 * @param {Array|Object} errors - Validation error details
 * @param {string} message - Error message (default: 'Validation failed')
 * @returns {Object} Express response object
 */
function validationErrorResponse(res, errors, message = 'Validation failed') {
  return errorResponse(res, message, 400, errors);
}

/**
 * Send an unauthorized error response (401)
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Unauthorized')
 * @returns {Object} Express response object
 */
function unauthorizedResponse(res, message = 'Unauthorized. Please login to continue.') {
  return errorResponse(res, message, 401);
}

/**
 * Send a forbidden error response (403)
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Forbidden')
 * @returns {Object} Express response object
 */
function forbiddenResponse(res, message = 'Forbidden. You do not have permission to access this resource.') {
  return errorResponse(res, message, 403);
}

/**
 * Send a not found error response (404)
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Resource not found')
 * @returns {Object} Express response object
 */
function notFoundResponse(res, message = 'Resource not found') {
  return errorResponse(res, message, 404);
}

/**
 * Send a conflict error response (409)
 * Common for duplicate resources (e.g., USN already exists)
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Resource already exists')
 * @returns {Object} Express response object
 */
function conflictResponse(res, message = 'Resource already exists') {
  return errorResponse(res, message, 409);
}

/**
 * Send an internal server error response (500)
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: generic error)
 * @returns {Object} Express response object
 */
function internalServerErrorResponse(res, message = 'An internal server error occurred. Please try again later.') {
  return errorResponse(res, message, 500);
}

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  conflictResponse,
  internalServerErrorResponse
};