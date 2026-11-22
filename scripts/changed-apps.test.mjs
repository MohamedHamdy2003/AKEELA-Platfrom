import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { apiAffected, frontendsAffected } from './changed-apps.mjs';

test('frontend-only and documentation changes do not rebuild the API', () => {
  assert.equal(
    apiAffected([
      'apps/admin/README.md',
      'apps/restaurant/README.md',
      'apps/delivery/README.md',
      'packages/portal/src/ui.tsx',
      'packages/brand/tokens.css',
      'docs/frontend/AKEELA-Admin-App.md',
      'AKEELA-Features.md',
      'bruno/AKEELA/bruno.json',
      'README.md',
    ]),
    false,
  );
});

test('API, deployment, shared lockfile/tooling and unknown changes rebuild it', () => {
  for (const file of [
    'apps/api/src/main.ts',
    'apps/api/Dockerfile',
    'package-lock.json',
    'package.json',
    '.github/workflows/release.yml',
    'deploy/Caddyfile',
    'compose.production.yml',
    'scripts/smoke.mjs',
    'AGENTS.md',
    'unclassified-file',
  ])
    assert.equal(apiAffected([file]), true, file);
});

test('mixed changes and Windows paths cannot hide an API change', () => {
  assert.equal(
    apiAffected(['docs/STATUS.md', 'apps\\api\\package.json']),
    true,
  );
  assert.equal(apiAffected([]), false);
});
test('frontend source/packaging needs image smoke, docs alone does not', () => {
  assert.equal(frontendsAffected(['apps/admin/src/app.tsx']), true);
  assert.equal(frontendsAffected(['apps\\delivery\\Dockerfile']), true);
  assert.equal(
    frontendsAffected(['apps/restaurant/README.md', 'docs/STATUS.md']),
    false,
  );
  assert.equal(frontendsAffected(['packages/portal/src/ui.tsx']), true);
});
