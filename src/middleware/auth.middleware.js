/**
 * Authentication Middleware
 * 
 * Verifies JWT tokens from Authorization header and attaches user info to request.
 * Does NOT perform database queries - token verification only.
 * 
 * Expected Header Format:
 * Authorization: Bearer <jwt_token>
 * 
 * Attached to req.user:
 * {
 *   user_id: 123,
 *   college_id: 45,
 *   role: 'STUDENT',
 *   usn: '1AB21CS001'
 * }
 */

const { verifyToken } = require('../utils/jwt.util');
const { unauthorizedResponse } = require('../utils/response.util');

/**
 * Authenticate JWT token from Authorization header
 * 
 * Middleware function that:
 * 1. Extracts token from Authorization header
 * 2. Verifies token validity and expiration
 * 3. Attaches decoded user info to req.user
 * 4. Allows request to proceed to next middleware/route handler
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
function authenticateToken(req, res, next) {
  try {
    // Extract Authorization header
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      return unauthorizedResponse(res, 'No authorization token provided');
    }

    // Check if header follows Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      return unauthorizedResponse(res, 'Invalid authorization format. Use: Bearer <token>');
    }

    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.substring(7);

    if (!token || token.trim() === '') {
      return unauthorizedResponse(res, 'Authorization token is empty');
    }

    // Verify token and extract payload
    const decoded = verifyToken(token);

    // Attach user information to request object for use in route handlers
    req.user = {
      user_id: decoded.user_id,
      college_id: decoded.college_id,
      role: decoded.role,
      usn: decoded.usn
    };

    // Token is valid, proceed to next middleware/route handler
    next();
  } catch (error) {
    // Token verification failed (expired, invalid, etc.)
    console.error(`[Auth Middleware] Token verification failed: ${error.message}`);
    return unauthorizedResponse(res, error.message);
  }
}

/**
 * Optional authentication middleware
 * Attaches user info if valid token exists, but doesn't block request if missing
 * Useful for endpoints that have different behavior for authenticated users
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
function optionalAuthentication(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token && token.trim() !== '') {
        const decoded = verifyToken(token);
        req.user = {
          user_id: decoded.user_id,
          college_id: decoded.college_id,
          role: decoded.role,
          usn: decoded.usn
        };
      }
    }

    // Always proceed, whether token was valid or not
    next();
  } catch (error) {
    // Token was invalid, but we don't block the request
    console.warn(`[Optional Auth] Invalid token ignored: ${error.message}`);
    next();
  }
}

module.exports = {
  authenticateToken,
  optionalAuthentication
};