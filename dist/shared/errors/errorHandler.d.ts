export interface ErrorResponse {
    success: false;
    errorCode: string;
    message: string;
    requestId: string;
}
export declare function handleError(error: unknown, requestId: string): ErrorResponse;
export declare function getHttpStatus(error: unknown): number;
//# sourceMappingURL=errorHandler.d.ts.map