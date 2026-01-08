// shared/errors/AppError.ts
export class AppError extends Error {
  public readonly errorCode: string;
  public readonly httpStatus: number;

  constructor(errorCode: string, httpStatus: number, message: string) {
    super(message);
    this.errorCode = errorCode;
    this.httpStatus = httpStatus;
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}