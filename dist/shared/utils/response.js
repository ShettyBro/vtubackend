export function successResponse(data, requestId) {
    return {
        success: true,
        data,
        requestId,
    };
}
export function errorResponse(errorCode, message, requestId) {
    return {
        success: false,
        errorCode,
        message,
        requestId,
    };
}
//# sourceMappingURL=response.js.map