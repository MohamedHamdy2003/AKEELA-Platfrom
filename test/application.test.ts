import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApplication } from '../src/bootstrap';

@Module({})
class HttpTestModule {}

test('HTTP bootstrap enforces CORS and consistent unknown-route errors', async () => {
  const module = await Test.createTestingModule({
    imports: [HttpTestModule],
  }).compile();
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
      .get('/api/v1/unknown')
      .set('Origin', 'https://untrusted.example.com')
      .expect(404);
    assert.equal(denied.headers['access-control-allow-origin'], undefined);
    await request(app.getHttpServer()).post('/api/v1/unknown').expect(404);
  } finally {
    await app.close();
  }
});
