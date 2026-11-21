import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Body, Controller, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApplication } from '../src/bootstrap';
import { RestaurantRegisterDto } from '../src/modules/auth/auth.dto';

@Controller('validation')
class ValidationTestController {
  @Post()
  validate(@Body() body: RestaurantRegisterDto) {
    return body;
  }
}

@Module({ controllers: [ValidationTestController] })
class HttpTestModule {}

test('validation errors explain fixes without exposing regular expressions', async () => {
  const module = await Test.createTestingModule({
    imports: [HttpTestModule],
  }).compile();
  const app = module.createNestApplication();
  configureApplication(app, []);
  try {
    await app.init();
    const result = await request(app.getHttpServer())
      .post('/api/v1/validation')
      .send({
        full_name: '',
        email: 'invalid',
        password: 'short',
        phone: '010123',
        unexpected: true,
        profile: {
          rest_title: '',
          rest_address: '',
          longitude: 'bad',
          latitude: 'bad',
          opens_at: '25:00',
          closes_at: 'bad',
        },
      })
      .expect(422);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
    assert.match(result.body.error.fields.phone[0], /country code/);
    assert.match(result.body.error.fields['profile.opens_at'][0], /24-hour/);
    assert.deepEqual(result.body.error.fields.unexpected, [
      'This field is not allowed.',
    ]);
    assert.doesNotMatch(
      JSON.stringify(result.body),
      /regular expression|must match|\^|\\d/,
    );
  } finally {
    await app.close();
  }
});

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
    assert.equal(allowed.headers['x-powered-by'], undefined);
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
