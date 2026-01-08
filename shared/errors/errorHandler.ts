// shared/errors/errorHandler.ts
import { AppError } from './AppError.js';

export interface ErrorResponse {
  success: false;
  errorCode: string;
  message: string;
  requestId: string;
}

export function handleError(error: unknown, requestId: string): ErrorResponse {
  if (error instanceof AppError) {
    return {
      success: false,
      errorCode: error.errorCode,
      message: error.message,
      requestId,
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      errorCode: 'INTERNAL_ERROR',
      message: error.message,
      requestId,
    };
  }

  return {
    success: false,
    errorCode: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    requestId,
  };
}

export function getHttpStatus(error: unknown): number {
  if (error instanceof AppError) {
    return error.httpStatus;
  }
  return 500;
}