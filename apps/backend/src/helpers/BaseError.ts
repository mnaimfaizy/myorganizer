export class BaseError<T> extends Error {
  public code: string;
  public status: number;
  public details: Record<string, { message: string; value: T }>;

  constructor(
    code: string,
    message: string,
    status: number,
    details: Record<string, { message: string; value: T }> = {}
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, BaseError.prototype);
  }

  static async createInvalidArgumentError<T>(
    details: Record<string, { message: string; value: T }>
  ): Promise<BaseError<T>> {
    return new BaseError<T>(
      'INVALID_ARGUMENT',
      'Validation Failed',
      400,
      details
    );
  }

  static async createNotFoundError<T>(
    details: Record<string, { message: string; value: T }>
  ): Promise<BaseError<T>> {
    return new BaseError<T>('NOT_FOUND', 'Resource not found', 404, details);
  }

  static async createInternalError<T>(
    details: Record<string, { message: string; value: T }>
  ): Promise<BaseError<T>> {
    return new BaseError<T>('INTERNAL', 'Internal server error', 500, details);
  }

  toJSON() {
    return {
      message: this.message,
      details: this.details,
    };
  }
}
