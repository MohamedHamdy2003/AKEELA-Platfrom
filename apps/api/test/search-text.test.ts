import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  buildSearchQueryTerms,
  escapeLikePattern,
  normalizeSearchText,
} from '../src/modules/catalog/search-text';

test('normalizeSearchText unifies Arabic letters, strips diacritics/tatweel, and collapses spaces', () => {
  assert.equal(normalizeSearchText('أكيلة'), 'اكيله');
  assert.equal(normalizeSearchText('إبراهيم وآدم ٱلله'), 'ابراهيم وادم الله');
  assert.equal(normalizeSearchText('شَاوَرْمَا  فَرَاخ  '), 'شاورما فراخ');
  assert.equal(normalizeSearchText('مشويّــــات كشرى'), 'مشويات كشري');
  assert.equal(normalizeSearchText('مؤمن و رئيس'), 'مومن و رييس');
  assert.equal(normalizeSearchText('  Crispy  BURGER  '), 'crispy burger');
});

test('escapeLikePattern escapes SQL LIKE wildcards and backslashes', () => {
  assert.equal(escapeLikePattern('100%_off\\deal'), '100\\%\\_off\\\\deal');
});

test('buildSearchQueryTerms builds LIKE patterns, deduplicated tokens (max 4), and fuzzy flag', () => {
  const multi = buildSearchQueryTerms(
    '  شاورما   فراخ   شاورما   سوري  كبير  جدا ',
  );
  assert.equal(multi.normalized, 'شاورما فراخ شاورما سوري كبير جدا');
  assert.deepEqual(multi.tokens, ['شاورما', 'فراخ', 'سوري', 'كبير']);
  assert.deepEqual(multi.tokenPatterns, [
    '%شاورما%',
    '%فراخ%',
    '%سوري%',
    '%كبير%',
  ]);
  assert.equal(multi.likeContains, '%شاورما فراخ شاورما سوري كبير جدا%');
  assert.equal(multi.likePrefix, 'شاورما فراخ شاورما سوري كبير جدا%');
  assert.equal(multi.useFuzzy, true);

  const short = buildSearchQueryTerms('بن');
  assert.equal(short.normalized, 'بن');
  assert.equal(short.useFuzzy, false);
});
