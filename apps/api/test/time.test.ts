import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  cairoDateString,
  cairoTimestamp,
  msUntilNextCairoMidnight,
} from '../src/common/time';
test('Cairo timestamps preserve instants and use winter/summer offsets', () => {
  for (const [input, expected] of [
    ['2026-01-15T22:30:00.123Z', '2026-01-16T00:30:00.123+02:00'],
    ['2026-07-15T22:30:00.123Z', '2026-07-16T01:30:00.123+03:00'],
  ] as const) {
    const output = cairoTimestamp(new Date(input));
    assert.equal(output, expected);
    assert.equal(Date.parse(output), Date.parse(input));
  }
});
test('Cairo date string and next-midnight delay handle winter and summer offsets', () => {
  assert.equal(
    cairoDateString(new Date('2026-01-15T22:30:00.000Z')),
    '2026-01-16',
  );
  assert.equal(
    cairoDateString(new Date('2026-07-15T20:30:00.000Z')),
    '2026-07-15',
  );
  // 2026-01-16 23:59:00+02:00 = 2026-01-16T21:59:00Z -> next 00:00:05 Cairo is 65s away
  const delay = msUntilNextCairoMidnight(new Date('2026-01-16T21:59:00.000Z'));
  assert.equal(delay, 65_000);
});
