/**
 * PROVISIONAL closed-test content. This bank is intentionally isolated so the
 * owner can replace it or introduce reviewed categories without touching the engine.
 */
export const SECRET_AGENTS_PROVISIONAL_WORDS = [
  'قمر',
  'شمس',
  'نجمة',
  'سحابة',
  'مطر',
  'ريح',
  'بحر',
  'نهر',
  'جبل',
  'وادي',
  'صحراء',
  'جزيرة',
  'شاطئ',
  'غابة',
  'شجرة',
  'وردة',
  'نخلة',
  'تفاحة',
  'برتقالة',
  'ليمون',
  'عنب',
  'تمر',
  'عسل',
  'خبز',
  'جبن',
  'قهوة',
  'شاي',
  'ماء',
  'ملح',
  'سكر',
  'مطبخ',
  'فرن',
  'ملعقة',
  'كوب',
  'طبق',
  'بيت',
  'باب',
  'نافذة',
  'مفتاح',
  'كرسي',
  'طاولة',
  'سرير',
  'مصباح',
  'مرآة',
  'ساعة',
  'كتاب',
  'قلم',
  'ورقة',
  'حقيبة',
  'مدرسة',
  'جامعة',
  'مكتبة',
  'مختبر',
  'حديقة',
  'ملعب',
  'سوق',
  'مطار',
  'محطة',
  'جسر',
  'طريق',
  'سيارة',
  'حافلة',
  'قطار',
  'طائرة',
  'سفينة',
  'دراجة',
  'قارب',
  'صاروخ',
  'روبوت',
  'حاسوب',
  'هاتف',
  'كاميرا',
  'شاشة',
  'بطارية',
  'شبكة',
  'رسالة',
  'خريطة',
  'بوصلة',
  'كنز',
  'قلعة',
  'برج',
  'متحف',
  'مسرح',
  'لوحة',
  'موسيقى',
  'عود',
  'طبل',
  'صوت',
  'فيلم',
  'قصة',
  'قصيدة',
  'لغز',
  'لعبة',
  'كرة',
  'هدف',
  'سباق',
  'ميدالية',
  'حكم',
  'فريق',
  'أسد',
  'نمر',
  'فيل',
  'زرافة',
  'حصان',
  'جمل',
  'غزال',
  'قرد',
  'أرنب',
  'سلحفاة',
  'دلفين',
  'حوت',
  'سمكة',
  'صقر',
  'حمامة',
  'فراشة',
  'نحلة',
  'طبيب',
  'معلم',
  'مهندس',
  'خباز',
  'مزارع',
  'بحار',
  'طيار',
  'رسام',
  'شاعر',
  'مصور',
  'شرطي',
  'إطفائي',
  'تاج',
  'خاتم',
  'درع',
  'سيف',
  'حبل',
  'مغناطيس',
  'مظلة',
  'نظارة',
  'قبعة',
  'حذاء',
  'قميص',
  'عملة',
  'هدية',
  'صندوق',
  'جرس',
  'شمعة',
  'ثلج',
  'نار',
  'دخان',
  'ظل',
  'لون',
  'ابتسامة',
] as const;

export function normalizeSecretAgentsArabic(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ar');
}

export function validateSecretAgentsProvisionalWords(
  words: readonly string[] = SECRET_AGENTS_PROVISIONAL_WORDS,
): { success: true; normalizedCount: number } | { success: false; error: string } {
  if (words.length < 100) {
    return { success: false, error: 'The provisional bank needs at least four full boards.' };
  }

  const normalized = new Set<string>();
  for (const word of words) {
    const value = normalizeSecretAgentsArabic(word);
    if (!value || value.length > 18 || value.includes(' ')) {
      return { success: false, error: `Invalid provisional word at index ${normalized.size}.` };
    }
    if (normalized.has(value)) {
      return { success: false, error: `Duplicate provisional word at index ${normalized.size}.` };
    }
    normalized.add(value);
  }

  return { success: true, normalizedCount: normalized.size };
}
