// shared/utils/response.ts
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  requestId: string;
}

export interface ErrorResponse {
  success: false;
  errorCode: string;
  message: string;
  requestId: string;
}

export function successResponse<T>(data: T, requestId: string): SuccessResponse<T> {
  return {
    success: true,
    data,
    requestId,
  };
}

export function errorResponse(
  errorCode: string,
  message: string,
  requestId: string
): ErrorResponse {
  return {
    success: false,
    errorCode,
    message,
    requestId,
  };
}