import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  RegisterDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from '../src/modules/auth/auth.dto';

test('all new-password inputs require 8–128 characters, a letter, and a digit', async () => {
  const candidates = [
    {
      type: RegisterDto,
      key: 'password',
      body: {
        full_name: 'Test User',
        email: 'test@example.com',
        phone: '+201000000001',
      },
    },
    {
      type: ResetPasswordDto,
      key: 'new_password',
      body: { email: 'test@example.com', otp: '123456' },
    },
    {
      type: ChangePasswordDto,
      key: 'new_password',
      body: { current_password: 'Existing password!2026' },
    },
  ];
  for (const candidate of candidates) {
    for (const password of ['Abcdefg1', 'كلمةمرور١', 'a'.repeat(127) + '1']) {
      const value = Object.assign(new candidate.type(), candidate.body, {
        [candidate.key]: password,
      });
      assert.equal(
        (await validate(value)).filter(
          (error) => error.property === candidate.key,
        ).length,
        0,
      );
    }
    for (const password of [
      'Abcdef1',
      'abcdefgh',
      '12345678',
      'a'.repeat(128) + '1',
    ]) {
      const value = Object.assign(new candidate.type(), candidate.body, {
        [candidate.key]: password,
      });
      assert.ok(
        (await validate(value)).some(
          (error) => error.property === candidate.key,
        ),
      );
    }
  }
  assert.equal(
    (
      await validate(
        plainToInstance(RegisterDto, {
          full_name: 'Test User',
          email: 'test@example.com',
          phone: '+201000000001',
          password: 'Abcdefg1',
        }),
      )
    ).length,
    0,
  );
});
