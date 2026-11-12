import { ValidationError } from 'class-validator';
import { ApiError } from './common/http/api-error';
import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';

export function configureApplication(
  app: INestApplication,
  allowedOrigins: string[],
  trustProxy = false,
): void {
  app.setGlobalPrefix('api/v1');
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', trustProxy ? 1 : false);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
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
            if (item.constraints) fields[key] = Object.values(item.constraints);
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
