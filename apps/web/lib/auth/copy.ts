import { getRoomErrorMessage } from '../room/error-messages';
import { SYSTEM_COPY } from '../ui/system-copy';

export const AUTH_COPY = {
  loginTitle: 'تسجيل الدخول',
  registerTitle: 'إنشاء حساب',
  emailLabel: 'البريد الإلكتروني',
  passwordLabel: 'كلمة المرور',
  nameLabel: 'الاسم',
  loginCta: 'تسجيل الدخول',
  registerCta: 'إنشاء حساب',
  submitting: 'جاري التحقق...',
  logout: 'تسجيل الخروج',
  playAsGuest: 'العب بدون حساب',
  saveNameTitle: 'حفظ الاسم المفضّل',
  benefit: 'احفظ اسمك وخله جاهز كل مرة ترجع فيها.',
  guestStillPlays: 'اللعب بدون حساب يبقى متاحاً',
  pageDescription:
    'الحساب اختياري. احفظ اسمك وخله جاهز كل مرة ترجع فيها. يمكنك دائماً اللعب بدون حساب.',
  invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  emailTaken: 'هذا البريد الإلكتروني مستخدم بالفعل.',
  invalidEmail: 'يرجى إدخال بريد إلكتروني صالح.',
  invalidName: 'الاسم يجب أن يكون بين حرفين و20 حرفاً.',
  invalidNameChars: 'الاسم يحتوي على رموز غير مسموحة.',
  passwordTooShort: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
  passwordTooLong: 'كلمة المرور طويلة جداً.',
  invalidInput: 'يرجى التحقق من البيانات المدخلة.',
  rateLimited: getRoomErrorMessage('RATE_LIMITED'),
  connectionFailed: getRoomErrorMessage('CONNECTION_FAILED'),
  genericError: SYSTEM_COPY.unexpectedError,
  adminMfaRequired: 'استخدم صفحة دخول الإدارة لإكمال التحقق الآمن.',
  resolvingSession: 'جاري التحقق من الحساب…',
} as const;
