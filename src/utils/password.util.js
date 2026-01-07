/**
 * Password Utility Module
 * 
 * Handles secure password hashing and comparison using bcrypt.
 * Uses 12 salt rounds for strong security without significant performance impact.
 * 
 * Security Notes:
 * - NEVER log passwords or hashes
 * - Salt rounds: 12 (good balance of security vs performance)
 * - All operations are asynchronous to prevent blocking
 */

const bcrypt = require('bcrypt');

// Salt rounds for bcrypt hashing (12 is recommended for production)
const SALT_ROUNDS = 12;

/**
 * Hash a plain text password using bcrypt
 * 
 * @param {string} plainPassword - Plain text password from user input
 * @returns {Promise<string>} Hashed password string
 * @throws {Error} If password is empty or hashing fails
 */
async function hashPassword(plainPassword) {
  // Validate input
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (plainPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  try {
    // Generate salt and hash password in one step
    const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('Error hashing password:', error.message);
    // Don't expose bcrypt internals to caller
    throw new Error('Failed to hash password');
  }
}

/**
 * Compare a plain text password with a hashed password
 * 
 * @param {string} plainPassword - Plain text password from login attempt
 * @param {string} hash - Hashed password from database
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 * @throws {Error} If comparison fails due to invalid input
 */
async function comparePassword(plainPassword, hash) {
  // Validate inputs
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (!hash || typeof hash !== 'string') {
    throw new Error('Hash must be a non-empty string');
  }

  try {
    // bcrypt.compare returns a boolean promise
    const isMatch = await bcrypt.compare(plainPassword, hash);
    return isMatch;
  } catch (error) {
    console.error('Error comparing password:', error.message);
    // Don't expose bcrypt internals to caller
    throw new Error('Failed to verify password');
  }
}

module.exports = {
  hashPassword,
  comparePassword
};