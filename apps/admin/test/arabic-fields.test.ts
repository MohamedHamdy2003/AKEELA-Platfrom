import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  arabicDigits,
  latinDigits,
  dateValue,
} from '../src/lib/arabic-fields.ts';
test('Arabic date input keeps valid Gregorian API dates and supports both Arabic digit sets', () => {
  assert.equal(latinDigits('٢٠٢٦ ۲۰۲۴'), '2026 2024');
  assert.equal(arabicDigits('2026'), '٢٠٢٦');
  assert.equal(dateValue('29', '2', '٢٠٢٤'), '2024-02-29');
  for (const parts of [
    ['29', '2', '2025'],
    ['31', '4', '2026'],
    ['0', '1', '2026'],
    ['1', '13', '2026'],
    ['1', '1', '0000'],
    ['1', '1', '20'],
  ])
    assert.equal(dateValue(...(parts as [string, string, string])), '');
  assert.equal(dateValue('1', '1', '0001'), '0001-01-01');
});
