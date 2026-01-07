/**
 * JWT Utility Module
 * 
 * Handles JWT token generation and verification for student authentication.
 * Uses HS256 algorithm with configurable expiry (default 4 hours).
 * 
 * Railway Deployment Notes:
 * - JWT_SECRET must be set in Railway environment variables
 * - Token expiry configurable via JWT_EXPIRY env var
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generate JWT token with student payload
 * 
 * @param {Object} payload - Token payload containing user info
 * @param {number} payload.user_id - Student ID from database
 * @param {number} payload.college_id - College ID from database
 * @param {string} payload.role - User role (always 'STUDENT' for this system)
 * @param {string} payload.usn - University Seat Number (unique identifier)
 * @returns {string} Signed JWT token
 * @throws {Error} If JWT_SECRET is not configured
 */
function generateToken(payload) {
  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET is not configured. Cannot generate token.');
  }

  // Validate required payload fields
  if (!payload.user_id || !payload.college_id || !payload.role || !payload.usn) {
    throw new Error('Invalid token payload. Missing required fields: user_id, college_id, role, or usn.');
  }

  try {
    const token = jwt.sign(
      {
        user_id: payload.user_id,
        college_id: payload.college_id,
        role: payload.role,
        usn: payload.usn
      },
      config.jwt.secret,
      {
        algorithm: 'HS256',
        expiresIn: config.jwt.expiry || '4h'
      }
    );

    return token;
  } catch (error) {
    console.error('Error generating JWT token:', error.message);
    throw new Error('Failed to generate authentication token');
  }
}

/**
 * Verify and decode JWT token
 * 
 * @param {string} token - JWT token string (without 'Bearer ' prefix)
 * @returns {Object} Decoded token payload
 * @returns {number} return.user_id - Student ID
 * @returns {number} return.college_id - College ID
 * @returns {string} return.role - User role
 * @returns {string} return.usn - University Seat Number
 * @throws {Error} If token is invalid, expired, or JWT_SECRET not configured
 */
function verifyToken(token) {
  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET is not configured. Cannot verify token.');
  }

  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256']
    });

    // Ensure required fields are present in decoded payload
    if (!decoded.user_id || !decoded.college_id || !decoded.role || !decoded.usn) {
      throw new Error('Invalid token structure');
    }

    return {
      user_id: decoded.user_id,
      college_id: decoded.college_id,
      role: decoded.role,
      usn: decoded.usn
    };
  } catch (error) {
    // Provide specific error messages for different JWT errors
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired. Please login again.');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token. Authentication failed.');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('Token not yet valid');
    } else {
      throw new Error(error.message || 'Token verification failed');
    }
  }
}

module.exports = {
  generateToken,
  verifyToken
};