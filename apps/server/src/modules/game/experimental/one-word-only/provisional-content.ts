import { normalizeOneWordClue } from './normalization.js';

export type OneWordOnlyContentEntry = {
  id: string;
  answer: string;
  distractors: readonly [string, string, string, string, string, string, string];
};

/** Original provisional closed-playtest bank; final editorial approval is still pending. */
export const ONE_WORD_ONLY_PROVISIONAL_CONTENT: readonly OneWordOnlyContentEntry[] = [
  {
    id: 'animal-lion',
    answer: 'أسد',
    distractors: ['نمر', 'فهد', 'ذئب', 'دب', 'ضبع', 'وشق', 'ثعلب'],
  },
  {
    id: 'animal-dolphin',
    answer: 'دلفين',
    distractors: ['حوت', 'قرش', 'فقمة', 'أخطبوط', 'سلحفاة', 'شفنين', 'بطريق'],
  },
  {
    id: 'food-pizza',
    answer: 'بيتزا',
    distractors: ['فطيرة', 'برغر', 'مناقيش', 'لازانيا', 'شاورما', 'كريب', 'ساندويتش'],
  },
  {
    id: 'food-coffee',
    answer: 'قهوة',
    distractors: ['شاي', 'كاكاو', 'حليب', 'عصير', 'سحلب', 'لاتيه', 'ليمونادة'],
  },
  {
    id: 'place-airport',
    answer: 'مطار',
    distractors: ['محطة', 'ميناء', 'مرآب', 'فندق', 'مستشفى', 'جامعة', 'ملعب'],
  },
  {
    id: 'place-library',
    answer: 'مكتبة',
    distractors: ['مدرسة', 'جامعة', 'متحف', 'مسرح', 'أرشيف', 'معرض', 'صحيفة'],
  },
  {
    id: 'object-umbrella',
    answer: 'مظلة',
    distractors: ['معطف', 'قبعة', 'وشاح', 'خيمة', 'عصا', 'حقيبة', 'منشفة'],
  },
  {
    id: 'object-key',
    answer: 'مفتاح',
    distractors: ['قفل', 'مقبض', 'زر', 'بطاقة', 'ختم', 'جرس', 'مسمار'],
  },
  {
    id: 'nature-volcano',
    answer: 'بركان',
    distractors: ['جبل', 'زلزال', 'وادي', 'كهف', 'شلال', 'صحراء', 'إعصار'],
  },
  {
    id: 'nature-rainbow',
    answer: 'قوس قزح',
    distractors: ['غيمة', 'برق', 'شفق', 'ضباب', 'مطر', 'شمس', 'قمر'],
  },
  {
    id: 'job-doctor',
    answer: 'طبيب',
    distractors: ['ممرض', 'صيدلي', 'جراح', 'مسعف', 'معلم', 'مهندس', 'طباخ'],
  },
  {
    id: 'job-detective',
    answer: 'محقق',
    distractors: ['شرطي', 'محامي', 'قاض', 'حارس', 'صحفي', 'جاسوس', 'مفتش'],
  },
  {
    id: 'sport-football',
    answer: 'كرة القدم',
    distractors: ['كرة السلة', 'كرة اليد', 'التنس', 'الطائرة', 'البيسبول', 'الهوكي', 'الرجبي'],
  },
  {
    id: 'sport-swimming',
    answer: 'سباحة',
    distractors: ['غوص', 'تجديف', 'إبحار', 'تزلج', 'جري', 'ملاكمة', 'جمباز'],
  },
  {
    id: 'transport-train',
    answer: 'قطار',
    distractors: ['مترو', 'حافلة', 'ترام', 'سيارة', 'شاحنة', 'طائرة', 'سفينة'],
  },
  {
    id: 'transport-bicycle',
    answer: 'دراجة',
    distractors: ['دراجة نارية', 'سكوتر', 'سيارة', 'عربة', 'لوح تزلج', 'حافلة', 'ترام'],
  },
  {
    id: 'tech-computer',
    answer: 'حاسوب',
    distractors: ['هاتف', 'لوحي', 'تلفاز', 'طابعة', 'كاميرا', 'خادم', 'حاسبة'],
  },
  {
    id: 'tech-password',
    answer: 'كلمة مرور',
    distractors: ['رمز', 'حساب', 'مفتاح', 'بصمة', 'توقيع', 'عنوان', 'شبكة'],
  },
  {
    id: 'music-guitar',
    answer: 'غيتار',
    distractors: ['عود', 'كمان', 'بيانو', 'ناي', 'طبلة', 'قانون', 'تشيلو'],
  },
  {
    id: 'music-song',
    answer: 'أغنية',
    distractors: ['قصيدة', 'لحن', 'موال', 'أنشودة', 'مقطوعة', 'سمفونية', 'إيقاع'],
  },
  {
    id: 'home-kitchen',
    answer: 'مطبخ',
    distractors: ['غرفة', 'حمام', 'صالة', 'شرفة', 'مخزن', 'حديقة', 'مرآب'],
  },
  {
    id: 'home-pillow',
    answer: 'وسادة',
    distractors: ['بطانية', 'مرتبة', 'ملاءة', 'منشفة', 'ستارة', 'سجادة', 'أريكة'],
  },
  {
    id: 'school-pencil',
    answer: 'قلم رصاص',
    distractors: ['قلم حبر', 'ممحاة', 'مسطرة', 'فرشاة', 'طبشور', 'دفتر', 'مبراة'],
  },
  {
    id: 'school-exam',
    answer: 'اختبار',
    distractors: ['واجب', 'درس', 'مسابقة', 'مقابلة', 'تجربة', 'تدريب', 'مشروع'],
  },
  {
    id: 'emotion-happiness',
    answer: 'سعادة',
    distractors: ['فرح', 'راحة', 'دهشة', 'حماس', 'حب', 'أمل', 'فخر'],
  },
  {
    id: 'emotion-fear',
    answer: 'خوف',
    distractors: ['قلق', 'رعب', 'حذر', 'حزن', 'غضب', 'خجل', 'توتر'],
  },
  {
    id: 'event-wedding',
    answer: 'زفاف',
    distractors: ['خطوبة', 'حفلة', 'تخرج', 'عيد ميلاد', 'مهرجان', 'وليمة', 'اجتماع'],
  },
  {
    id: 'event-travel',
    answer: 'سفر',
    distractors: ['رحلة', 'هجرة', 'نزهة', 'زيارة', 'مغامرة', 'جولة', 'تنقل'],
  },
  {
    id: 'time-midnight',
    answer: 'منتصف الليل',
    distractors: ['فجر', 'شروق', 'صباح', 'ظهيرة', 'غروب', 'مساء', 'ليل'],
  },
  {
    id: 'weather-snow',
    answer: 'ثلج',
    distractors: ['عاصفة', 'مطر', 'بَرَد', 'جليد', 'صقيع', 'ضباب', 'ندى'],
  },
] as const;

export function validateOneWordOnlyProvisionalContent():
  { success: true; count: number } | { success: false; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set<string>();
  const answers = new Set<string>();
  for (const entry of ONE_WORD_ONLY_PROVISIONAL_CONTENT) {
    if (ids.has(entry.id)) errors.push(`معرّف مكرر: ${entry.id}`);
    ids.add(entry.id);
    const answer = normalizeOneWordClue(entry.answer);
    if (answers.has(answer)) errors.push(`إجابة مكررة: ${entry.answer}`);
    answers.add(answer);
    if (entry.distractors.length !== 7) errors.push(`يلزم 7 مشتتات: ${entry.id}`);
    const options = [entry.answer, ...entry.distractors].map(normalizeOneWordClue);
    if (new Set(options).size !== 8) errors.push(`خيارات متكررة: ${entry.id}`);
  }
  return errors.length > 0
    ? { success: false, errors }
    : { success: true, count: ONE_WORD_ONLY_PROVISIONAL_CONTENT.length };
}
