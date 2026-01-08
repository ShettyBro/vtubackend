// shared/auth/jwt.ts
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError.js';

export interface JWTPayload {
  userId: string;
  role: string;
  [key: string]: unknown;
}

const JWT_EXPIRY = '4h';

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('CONFIG_ERROR', 500, 'JWT_SECRET not configured');
  }
  return secret;
}

export function signJWT(payload: JWTPayload): string {
  const secret = getJWTSecret();
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRY });
}

export function verifyJWT(token: string): JWTPayload {
  const secret = getJWTSecret();
  
  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('TOKEN_EXPIRED', 401, 'Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('INVALID_TOKEN', 401, 'Invalid token');
    }
    throw new AppError('TOKEN_VERIFICATION_FAILED', 401, 'Token verification failed');
  }
}

export function extractBearerToken(authHeader: string | undefined): string {
  if (!authHeader) {
    throw new AppError('MISSING_TOKEN', 401, 'Authorization header is required');
  }

  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AppError('INVALID_AUTH_HEADER', 401, 'Invalid Authorization header format');
  }

  const token = parts[1];
  
  if (!token) {
    throw new AppError('MISSING_TOKEN', 401, 'Token is required');
  }

  return token;
}