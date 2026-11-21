import { CairoTimeInterceptor } from './common/time';
import { static as serveStatic } from 'express';
import { resolve } from 'node:path';
import { ValidationError } from 'class-validator';
import { ApiError } from './common/http/api-error';
import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';

export function configureApplication(
  app: INestApplication,
  allowedOrigins: string[],
  trustProxy = false,
  imageStoragePath?: string,
): void {
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new CairoTimeInterceptor());
  if (imageStoragePath)
    app.use(
      '/images',
      serveStatic(resolve(imageStoragePath), {
        dotfiles: 'deny',
        index: false,
        redirect: false,
        immutable: true,
        maxAge: '1y',
      }),
    );
  const express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  express.set('trust proxy', trustProxy ? 1 : false);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    {
      transform(value: unknown, metadata: { type: string }) {
        if (
          metadata.type === 'param' &&
          (typeof value !== 'string' ||
            !/^[1-9]\d{0,18}$/.test(value) ||
            BigInt(value) > 9223372036854775807n)
        )
          throw new ApiError(
            422,
            'VALIDATION_ERROR',
            'Enter a valid positive record ID.',
          );
        return value;
      },
    },
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      validationError: { target: false, value: false },
      exceptionFactory: (errors: ValidationError[]) => {
        const fields: Record<string, string[]> = {};
        const visit = (items: ValidationError[], prefix = '') => {
          for (const item of items) {
            const key = prefix + item.property;
            if (item.constraints) {
              fields[key] = Object.entries(item.constraints).map(
                ([constraint, message]) =>
                  constraint === 'whitelistValidation'
                    ? 'This field is not allowed.'
                    : message,
              );
            }
            if (item.children?.length) visit(item.children, key + '.');
          }
        };
        visit(errors);
        return new ApiError(
          422,
          'VALIDATION_ERROR',
          'Please check the input.',
          fields,
        );
      },
    }),
  );
  app.enableCors({ origin: allowedOrigins.length ? allowedOrigins : false });
  app.enableShutdownHooks();
}
