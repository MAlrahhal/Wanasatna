import type { RoomErrorCode } from '@wanasatna/shared';

const ERROR_MESSAGES: Record<RoomErrorCode, string> = {
  VALIDATION_ERROR: 'يرجى التحقق من البيانات المدخلة.',
  ROOM_NOT_FOUND: 'الغرفة غير موجودة.',
  ROOM_CLOSED: 'هذه الغرفة مغلقة.',
  ROOM_LOCKED: 'الغرفة مقفلة ولا يمكن الانضمام إليها.',
  ROOM_FULL: 'الغرفة ممتلئة.',
  PLAYER_ALREADY_EXISTS: 'اسم اللاعب مستخدم بالفعل في هذه الغرفة.',
  PLAYER_NOT_FOUND: 'تعذر العثور على اللاعب.',
  NOT_HOST: 'هذا الإجراء متاح للمضيف فقط.',
  CANNOT_KICK_SELF: 'لا يمكن للمضيف طرد نفسه.',
  RECONNECT_EXPIRED: 'انتهت مهلة إعادة الاتصال. يرجى الانضمام من جديد.',
  RECONNECT_INVALID_TOKEN: 'انتهت صلاحية بيانات إعادة الاتصال. يمكنك الانضمام من جديد.',
  MATCH_IN_PROGRESS: 'هناك مباراة جارية حاليًا. يمكنك الانضمام عند انتهاء المباراة.',
  ROOM_CODE_GENERATION_FAILED: 'تعذر إنشاء رمز الغرفة. حاول مرة أخرى.',
  CONNECTION_FAILED: 'تعذر الاتصال بالخادم. تأكد أن الخادم يعمل ثم حاول مرة أخرى.',
  INTERNAL_ERROR: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
};

export function getRoomErrorMessage(code: RoomErrorCode, fallback?: string): string {
  if (code === 'VALIDATION_ERROR') {
    return mapRoomValidationMessage(fallback) ?? fallback ?? ERROR_MESSAGES.VALIDATION_ERROR;
  }

  const mapped = ERROR_MESSAGES[code];
  if (mapped) {
    return mapped;
  }

  return fallback ?? ERROR_MESSAGES.INTERNAL_ERROR;
}

function mapRoomValidationMessage(message?: string): string | null {
  if (!message) {
    return null;
  }

  if (message.includes('at least 2 characters')) {
    return 'يجب أن يكون الاسم حرفين على الأقل.';
  }

  if (message.includes('at most 20 characters')) {
    return 'يجب ألا يزيد الاسم عن 20 حرفاً.';
  }

  if (message.includes('exactly 6 digits')) {
    return 'رمز الغرفة يجب أن يكون 6 أرقام.';
  }

  return null;
}
