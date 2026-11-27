const ARABIC_DIACRITICS_AND_TATWEEL = /[\u064B-\u065F\u0670\u0640]+/g;

const ARABIC_CHAR_MAP: Record<string, string> = {
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  ٱ: 'ا',
  ة: 'ه',
  ى: 'ي',
  ؤ: 'و',
  ئ: 'ي',
};

const ARABIC_VARIANTS = /[أإآٱةىؤئ]/g;

/**
 * Mirrors PostgreSQL `normalize_search_text(TEXT)` identically so application-side
 * query patterns match expression GIN indexes without divergence.
 */
export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(ARABIC_DIACRITICS_AND_TATWEEL, '')
    .replace(ARABIC_VARIANTS, (ch) => ARABIC_CHAR_MAP[ch] ?? ch)
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

export interface SearchQueryTerms {
  raw: string;
  normalized: string;
  likeContains: string;
  likePrefix: string;
  tokens: string[];
  tokenPatterns: string[];
  useFuzzy: boolean;
}

export function buildSearchQueryTerms(rawInput: string): SearchQueryTerms {
  const raw = rawInput.trim();
  const normalized = normalizeSearchText(raw);
  const escaped = escapeLikePattern(normalized);
  const tokens = normalized
    ? [
        ...new Set(normalized.split(' ').filter((part) => part.length > 0)),
      ].slice(0, 4)
    : [];

  return {
    raw,
    normalized,
    likeContains: `%${escaped}%`,
    likePrefix: `${escaped}%`,
    tokens,
    tokenPatterns: tokens.map((token) => `%${escapeLikePattern(token)}%`),
    useFuzzy: tokens.some((token) => token.length >= 4),
  };
}
