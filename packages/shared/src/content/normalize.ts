function normalizeDigit(digit: string): string {
  const codePoint = digit.codePointAt(0) ?? 0;

  if (codePoint >= 0x0660 && codePoint <= 0x0669) {
    return String(codePoint - 0x0660);
  }

  if (codePoint >= 0x06f0 && codePoint <= 0x06f9) {
    return String(codePoint - 0x06f0);
  }

  return digit;
}

/** Exact answer normalization shared by content validation and all free-text games. */
export function normalizeTextAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[٠-٩۰-۹]/g, normalizeDigit)
    .replace(/\u0640/g, '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/^ال(?=[\p{L}\p{N}])/u, '')
    .replace(/[أإآٱا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[-–—]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAcceptedAnswerKey(value: string): string {
  return normalizeTextAnswer(value);
}

export function normalizeCanonicalEntryKey(value: string): string {
  return normalizeTextAnswer(value);
}
