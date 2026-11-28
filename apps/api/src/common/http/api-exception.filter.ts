import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request | undefined>();
    const response = http.getResponse<Response>();
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
      const isMulterFileTooLarge =
        status === 413 &&
        !details.code &&
        typeof details.message === 'string' &&
        /file too large/i.test(details.message);
      code =
        details.code ??
        (isMulterFileTooLarge
          ? 'IMAGE_TOO_LARGE'
          : ({
              401: 'UNAUTHENTICATED',
              403: 'FORBIDDEN',
              404: 'NOT_FOUND',
              413: 'PAYLOAD_TOO_LARGE',
              429: 'RATE_LIMITED',
            }[status] ?? 'REQUEST_FAILED'));
      message =
        details.code && typeof details.message === 'string'
          ? details.message
          : isMulterFileTooLarge
            ? 'Image must be 5MB or smaller.'
            : ({
                400: 'Invalid request body.',
                413: 'Request payload is too large.',
                401: 'Authentication is required.',
                403: 'Access is denied.',
                404: 'Record or route not found.',
                429: 'Too many requests.',
              }[status] ?? 'The request could not be completed.');
      fields = details.fields;
    } else if (
      error instanceof QueryFailedError &&
      ['22P02', '22003', '22007', '22008'].includes(
        (error.driverError as { code?: string } | undefined)?.code ?? '',
      )
    ) {
      status = 422;
      code = 'VALIDATION_ERROR';
      message = 'Check the numbers, record IDs, and dates in your request.';
    } else if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code === '23505'
    ) {
      const driverError = error.driverError as {
        constraint?: string;
        table?: string;
      };
      const isUserIdentityConflict =
        driverError.table === 'users' ||
        driverError.constraint === 'uq_users_email' ||
        driverError.constraint === 'uq_users_phone';
      status = 409;
      code = 'CONFLICT';
      message = isUserIdentityConflict
        ? 'An account with this email or phone already exists.'
        : 'A conflicting record already exists.';
    } else if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code === '57014'
    ) {
      status = 504;
      code = 'REQUEST_TIMEOUT';
      message = 'The request took too long to complete. Please try again.';
    } else if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code === '53300'
    ) {
      status = 503;
      code = 'SERVICE_UNAVAILABLE';
      message = 'The service is temporarily busy. Please try again shortly.';
    } else {
      // Never log SQL, request bodies, credentials, or raw tokens.
      const method = request?.method ?? 'UNKNOWN';
      const path = (request?.path ?? request?.url ?? '').split('?')[0] || '/';
      const errName = error instanceof Error ? error.name : 'UnknownError';
      const pgCode =
        error instanceof QueryFailedError
          ? (error.driverError as { code?: string })?.code
          : undefined;
      Logger.error(
        `Unhandled request failure: ${method} ${path} [${errName}${pgCode ? ` pg:${pgCode}` : ''}]`,
        'HTTP',
      );
    }
    response.status(status).json({
      success: false,
      message,
      error: { code, ...(fields ? { fields } : {}) },
    });
  }
}
