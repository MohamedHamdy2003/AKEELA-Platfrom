import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    let fields: Record<string, string[]> | undefined;
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      const details =
        typeof body === 'object'
          ? (body as {
              code?: string;
              message?: string;
              fields?: Record<string, string[]>;
            })
          : {};
      code =
        details.code ??
        {
          401: 'UNAUTHENTICATED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
          429: 'RATE_LIMITED',
        }[status] ??
        'REQUEST_FAILED';
      message =
        details.code && typeof details.message === 'string'
          ? details.message
          : ({
              400: 'Invalid request body.',
              401: 'Authentication is required.',
              403: 'Access is denied.',
              404: 'Record or route not found.',
              429: 'Too many requests.',
            }[status] ?? 'The request could not be completed.');
      fields = details.fields;
    } else if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      status = 409;
      code = 'CONFLICT';
      message = 'An account with this email or phone already exists.';
    } else {
      // Never log SQL, request bodies, credentials, or raw tokens.
      Logger.error('Unhandled request failure.', 'HTTP');
    }
    response.status(status).json({
      success: false,
      message,
      error: { code, ...(fields ? { fields } : {}) },
    });
  }
}
