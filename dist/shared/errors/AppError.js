// shared/errors/AppError.ts
export class AppError extends Error {
    errorCode;
    httpStatus;
    constructor(errorCode, httpStatus, message) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
        this.name = 'AppError';
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
//# sourceMappingURL=AppError.js.map