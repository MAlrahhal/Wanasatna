export type FaqCategory = 'play' | 'account' | 'technical';

export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
};

export const faqCategories: { id: FaqCategory; label: string }[] = [
  { id: 'play', label: 'اللعب والغرف' },
  { id: 'account', label: 'الحساب' },
  { id: 'technical', label: 'المشاكل التقنية' },
];

export const faqItems: FaqItem[] = [
  {
    id: 'account-required',
    category: 'play',
    question: 'هل أحتاج إلى حساب للعب؟',
    answer:
      'لا. يمكنك اللعب مباشرة بإدخال اسمك فقط. الحساب اختياري وغير مطلوب للعب.',
  },
  {
    id: 'create-room',
    category: 'play',
    question: 'كيف أنشئ غرفة؟',
    answer:
      'من الصفحة الرئيسية، أدخل اسمك في بطاقة «إنشاء غرفة» واضغط إنشاء. سيتم نقلك إلى اللوبي حيث يمكنك مشاركة رمز الغرفة مع أصدقائك.',
  },
  {
    id: 'join-room',
    category: 'play',
    question: 'كيف أنضم إلى غرفة؟',
    answer:
      'أدخل اسمك ورمز الغرفة المكوّن من 6 أرقام في بطاقة «الانضمام إلى غرفة» على الصفحة الرئيسية.',
  },
  {
    id: 'player-count',
    category: 'play',
    question: 'كم عدد اللاعبين المدعوم؟',
    answer: 'تدعم وناستنا حتى 8 لاعباً في الغرفة الواحدة، حسب اللعبة المختارة.',
  },
  {
    id: 'mobile',
    category: 'play',
    question: 'هل تعمل وناستنا على الجوال؟',
    answer: 'نعم. المنصة مصممة للعمل في المتصفح على الجوال والكمبيوتر.',
  },
  {
    id: 'free-play',
    category: 'play',
    question: 'هل اللعب مجاني؟',
    answer: 'نعم. اللعب الأساسي مجاني ولا يتطلب تسجيلاً.',
  },
  {
    id: 'login-benefit',
    category: 'account',
    question: 'ما فائدة تسجيل الدخول؟',
    answer:
      'الحساب اختياري. احفظ اسمك وخله جاهز كل مرة ترجع فيها. يمكنك دائماً اللعب بدون حساب.',
  },
  {
    id: 'disconnect',
    category: 'technical',
    question: 'ماذا يحدث إذا انقطع الاتصال؟',
    answer:
      'إذا انقطع اتصالك، حاول إعادة فتح الرابط أو الانضمام مجدداً برمز الغرفة. قد تحتاج لإعادة الدخول باسمك حتى يعود الاتصال.',
  },
];
