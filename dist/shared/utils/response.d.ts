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
export declare function successResponse<T>(data: T, requestId: string): SuccessResponse<T>;
export declare function errorResponse(errorCode: string, message: string, requestId: string): ErrorResponse;
//# sourceMappingURL=response.d.ts.map