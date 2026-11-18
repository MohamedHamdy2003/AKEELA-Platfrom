import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewAudit } from './audit-runtime.mjs';
const source = {
  name: 'picomatch',
  severity: 'high',
  url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
};
const report = (via) => ({
  metadata: {},
  vulnerabilities: { picomatch: { via }, typeorm: { via: ['picomatch'] } },
});
test('audit exception is narrow, expires, and never hides new findings', () => {
  assert.equal(
    reviewAudit(report([source]), new Date('2026-11-18')).accepted,
    true,
  );
  assert.equal(
    reviewAudit(report([source]), new Date('2026-12-19')).blocked.length,
    1,
  );
  assert.equal(
    reviewAudit(
      report([source, { ...source, url: 'https://github.com/advisories/NEW' }]),
      new Date('2026-11-18'),
    ).blocked.length,
    1,
  );
  assert.equal(reviewAudit(report([]), new Date('2026-11-18')).accepted, false);
  assert.throws(() => reviewAudit({ error: 'network error' }));
  assert.throws(() =>
    reviewAudit({ metadata: {}, vulnerabilities: { a: { via: ['missing'] } } }),
  );
});
