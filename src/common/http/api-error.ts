import { HttpException } from '@nestjs/common';

export class ApiError extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string[]>,
  ) {
    super({ code, message, ...(fields ? { fields } : {}) }, status);
  }
}

export function reply<T>(data: T, message = 'Request completed.') {
  return { success: true, message, data };
}
