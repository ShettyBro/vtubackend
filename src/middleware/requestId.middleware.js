/**
 * Request ID Middleware
 * 
 * Generates a unique identifier for each incoming request to aid in
 * debugging and log correlation. The request ID is:
 * 1. Attached to req.id for use in application code
 * 2. Added to response headers as X-Request-ID
 * 3. Included in all error responses
 * 
 * This is especially useful in Railway deployments where multiple
 * instances might be running and you need to trace a specific request
 * through logs.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Generate and attach unique request ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
function requestIdMiddleware(req, res, next) {
  // Check if client provided a request ID (useful for client-side tracing)
  const clientRequestId = req.headers['x-request-id'];

  // Use client-provided ID if valid, otherwise generate new one
  const requestId = clientRequestId && isValidUUID(clientRequestId) 
    ? clientRequestId 
    : uuidv4();

  // Attach to request object for use in route handlers and other middleware
  req.id = requestId;

  // Add to response headers so client can reference it
  res.setHeader('X-Request-ID', requestId);

  // Log incoming request with ID
  console.log(`[${requestId}] ${req.method} ${req.originalUrl}`);

  next();
}

/**
 * Validate if a string is a valid UUID v4
 * 
 * @param {string} str - String to validate
 * @returns {boolean} True if valid UUID v4
 */
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

module.exports = requestIdMiddleware;