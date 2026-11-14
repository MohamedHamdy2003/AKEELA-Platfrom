import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { cairoTimestamp } from '../src/common/time';
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
