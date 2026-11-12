import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApplication } from '../src/bootstrap';
import { DatabaseModule } from '../src/database/database.module';

@Module({})
class NoDatabaseTestModule {}

test('application composes without business routes and enforces CORS allowlist', async () => {
  // Only tests bypass the connection. Production AppModule always uses DatabaseModule.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/unused';
  process.env.CORS_ORIGINS = '';
  process.env.DATABASE_SSL = 'false';
  process.env.PORT = '3000';
  const { AppModule } = await import('../src/app.module');
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(DatabaseModule)
    .useModule(NoDatabaseTestModule)
    .compile();
  const app = module.createNestApplication();
  configureApplication(app, ['https://dashboard.example.com']);
  try {
    await app.init();
    const allowed = await request(app.getHttpServer())
      .get('/api/v1/customer/orders')
      .set('Origin', 'https://dashboard.example.com')
      .expect(404);
    assert.equal(
      allowed.headers['access-control-allow-origin'],
      'https://dashboard.example.com',
    );
    const denied = await request(app.getHttpServer())
      .get('/api/v1/auth/login')
      .set('Origin', 'https://untrusted.example.com')
      .expect(404);
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .expect(404);
  } finally {
    await app.close();
  }
});
