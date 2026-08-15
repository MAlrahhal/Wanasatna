/**
 * Content-text keys for validation.
 * Matching-key must stay aligned with Fast Answer `normalizeAnswerText`
 * (trim, lower, tatweel off, أإآ→ا, ى→ي, tashkeel off, dashes→space,
 * strip non-letter/digit, collapse spaces). Does NOT map ة→ه.
 */

export function normalizeAcceptedAnswerKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u0640/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Duplicate canonical entries also fold ة→ه so spelling twins are caught. */
export function normalizeCanonicalEntryKey(value: string): string {
  return normalizeAcceptedAnswerKey(value).replace(/ة/g, 'ه');
}
