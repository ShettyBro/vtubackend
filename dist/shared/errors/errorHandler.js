// shared/errors/errorHandler.ts
import { AppError } from './AppError.js';
export function handleError(error, requestId) {
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
export function getHttpStatus(error) {
    if (error instanceof AppError) {
        return error.httpStatus;
    }
    return 500;
}
//# sourceMappingURL=errorHandler.js.map