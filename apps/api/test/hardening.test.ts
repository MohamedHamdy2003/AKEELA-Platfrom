import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ApiRateLimitGuard } from '../src/common/http/api-rate-limit.guard';
import { ApiError } from '../src/common/http/api-error';
import { ImagesCleanupService } from '../src/modules/images/images-cleanup.service';
import type { Environment } from '../src/config/environment';
import type { CustomersService } from '../src/modules/customers/customers.service';
import type { RestaurantsService } from '../src/modules/restaurants/restaurants.service';
import type { CatalogService } from '../src/modules/catalog/catalog.service';

function mockConfig(
  values: Partial<Environment>,
): ConfigService<Environment, true> {
  return {
    get: (key: keyof Environment) => values[key],
  } as unknown as ConfigService<Environment, true>;
}

function mockHttpContext(path: string, ip = '203.0.113.10') {
  const headers = new Map<string, string | number>();
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ path, url: path, ip }),
      getResponse: () => ({
        setHeader: (name: string, value: string | number) => {
          headers.set(name, value);
        },
      }),
    }),
  } as unknown as ExecutionContext;
  return { context, headers };
}

test('ApiRateLimitGuard enforces 300 req/min per IP while bypassing health checks and test mode', () => {
  const prodGuard = new ApiRateLimitGuard(
    mockConfig({ NODE_ENV: 'production' }),
  );
  for (let i = 0; i < 300; i += 1) {
    const { context } = mockHttpContext('/api/v1/restaurants');
    assert.equal(prodGuard.canActivate(context), true);
  }
  const blocked = mockHttpContext('/api/v1/restaurants');
  assert.throws(
    () => prodGuard.canActivate(blocked.context),
    (error: unknown) =>
      error instanceof ApiError &&
      error.getStatus() === 429 &&
      (error.getResponse() as { code?: string }).code === 'RATE_LIMITED',
  );
  assert.ok(Number(blocked.headers.get('Retry-After')) >= 1);

  // Health probes remain allowed even when the IP is rate-limited.
  assert.equal(
    prodGuard.canActivate(mockHttpContext('/api/v1/health/live').context),
    true,
  );
  assert.equal(
    prodGuard.canActivate(mockHttpContext('/api/v1/health/ready').context),
    true,
  );

  // Test mode bypasses the guard completely.
  const testGuard = new ApiRateLimitGuard(mockConfig({ NODE_ENV: 'test' }));
  for (let i = 0; i < 350; i += 1) {
    assert.equal(
      testGuard.canActivate(mockHttpContext('/api/v1/restaurants').context),
      true,
    );
  }
});

test('ImagesCleanupService deletes only old unreferenced managed WebP files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'akeela-img-cleanup-'));
  try {
    const orphanOld = '11111111-1111-4111-8111-111111111111.webp';
    const referencedOld = '22222222-2222-4222-8222-222222222222.webp';
    const orphanFresh = '33333333-3333-4333-8333-333333333333.webp';
    const unrelatedOld = 'keep-me.txt';

    for (const file of [orphanOld, referencedOld, orphanFresh, unrelatedOld]) {
      await writeFile(join(dir, file), 'stub');
    }

    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    for (const file of [orphanOld, referencedOld, unrelatedOld]) {
      await utimes(join(dir, file), oldDate, oldDate);
    }

    const service = new ImagesCleanupService(
      mockConfig({ NODE_ENV: 'test', IMAGE_STORAGE_PATH: dir }),
      {
        referencedAvatarUrls: async () => [
          `https://api.example.com/images/${referencedOld}`,
        ],
      } as unknown as CustomersService,
      { referencedImageUrls: async () => [] } as unknown as RestaurantsService,
      { referencedImageUrls: async () => [] } as unknown as CatalogService,
    );

    const removed = await service.cleanupOrphans();
    assert.equal(removed, 1);

    const remaining = (await readdir(dir)).sort();
    assert.deepEqual(
      remaining,
      [orphanFresh, referencedOld, unrelatedOld].sort(),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
