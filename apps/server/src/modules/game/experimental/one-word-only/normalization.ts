const ARABIC_DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/gu;
const TATWEEL = /\u0640/gu;
const ALIF_VARIANTS = /[أإآٱ]/gu;

/** Narrow spelling normalization for clue equality; deliberately does not fold ى into ي. */
export function normalizeOneWordClue(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(ARABIC_DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(ALIF_VARIANTS, 'ا')
    .replaceAll('ة', 'ه')
    .toLocaleLowerCase('en-US');
}

export function validateOneWordClue(
  value: unknown,
): { success: true; text: string; normalized: string } | { success: false; error: string } {
  if (typeof value !== 'string') {
    return { success: false, error: 'اكتب تلميحًا من كلمة واحدة.' };
  }
  const text = value.normalize('NFKC').trim();
  if (text.length === 0 || text.length > 30) {
    return { success: false, error: 'يجب أن يكون التلميح كلمة واحدة من 1 إلى 30 حرفًا.' };
  }
  if (!/^[\p{Script=Arabic}\p{Script=Latin}\p{M}ـ]+$/u.test(text)) {
    return { success: false, error: 'استخدم حروفًا عربية أو إنجليزية فقط، بلا مسافات أو رموز.' };
  }
  const normalized = normalizeOneWordClue(text);
  if (!normalized || !/^[\p{Script=Arabic}\p{Script=Latin}]+$/u.test(normalized)) {
    return { success: false, error: 'التلميح غير صالح.' };
  }
  return { success: true, text, normalized };
}
