import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApplication } from './bootstrap';
import { Environment } from './config/environment';
import { configureSwagger } from './documentation/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Environment, true>);
  configureApplication(
    app,
    config.get('CORS_ORIGINS', { infer: true }),
    config.get('TRUST_PROXY', { infer: true }),
    config.get('IMAGE_STORAGE_PATH', { infer: true }),
  );
  configureSwagger(app, config.get('SWAGGER_ENABLED', { infer: true }));
  try {
    await app.listen(config.get('PORT', { infer: true }));
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap().catch(() => {
  // Avoid exposing connection URLs or credentials in unhandled startup errors.
  Logger.error(
    'Application startup failed. Check configuration and database availability.',
    'Bootstrap',
  );
  process.exitCode = 1;
});
