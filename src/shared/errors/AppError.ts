export type AppErrorCode =
  | 'validation'
  | 'permission'
  | 'conflict'
  | 'business_rule'
  | 'integration'
  | 'network'
  | 'unexpected';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}
