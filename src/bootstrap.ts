import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';

export function configureApplication(
  app: INestApplication,
  allowedOrigins: string[],
): void {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );
  app.enableCors({ origin: allowedOrigins.length ? allowedOrigins : false });
  app.enableShutdownHooks();
}
