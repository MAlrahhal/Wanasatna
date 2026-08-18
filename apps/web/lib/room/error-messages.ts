import type { RoomErrorCode } from '@wanasatna/shared';
import { SYSTEM_COPY, toSafeUserErrorMessage } from '../ui/system-copy';

const ERROR_MESSAGES: Record<RoomErrorCode, string> = {
  VALIDATION_ERROR: 'يرجى التحقق من البيانات المدخلة.',
  ROOM_NOT_FOUND: SYSTEM_COPY.roomMissing,
  ROOM_CLOSED: SYSTEM_COPY.roomClosed,
  ROOM_LOCKED: SYSTEM_COPY.roomLocked,
  ROOM_FULL: SYSTEM_COPY.roomFull,
  PLAYER_ALREADY_EXISTS: 'اسم اللاعب مستخدم بالفعل في هذه الغرفة.',
  PLAYER_NOT_FOUND: 'تعذر العثور على اللاعب.',
  NOT_HOST: 'هذا الإجراء متاح للمضيف فقط.',
  FORBIDDEN: 'غير مصرح لك بتعديل هذه الإعدادات.',
  CANNOT_KICK_SELF: 'لا يمكن للمضيف طرد نفسه.',
  RECONNECT_EXPIRED: SYSTEM_COPY.reconnectExpired,
  RECONNECT_INVALID_TOKEN: SYSTEM_COPY.reconnectExpired,
  MATCH_IN_PROGRESS: 'هناك مباراة جارية حاليًا. يمكنك الانضمام عند انتهاء المباراة.',
  ROOM_CODE_GENERATION_FAILED: 'تعذر إنشاء رمز الغرفة. حاول مرة أخرى.',
  CONNECTION_FAILED: 'تعذر الاتصال. حاول مرة أخرى.',
  RATE_LIMITED: 'طلبات كثيرة بسرعة، انتظر شوي وحاول مرة ثانية.',
  ROOM_ENTRY_IN_PROGRESS: 'يتم الدخول للغرفة الآن، حاول مرة ثانية.',
  INTERNAL_ERROR: SYSTEM_COPY.unexpectedError,
};

export function getRoomErrorMessage(code: RoomErrorCode, fallback?: string): string {
  if (code === 'VALIDATION_ERROR') {
    return mapRoomValidationMessage(fallback) ?? fallback ?? ERROR_MESSAGES.VALIDATION_ERROR;
  }

  const mapped = ERROR_MESSAGES[code];
  if (mapped) {
    return mapped;
  }

  return toSafeUserErrorMessage(fallback, ERROR_MESSAGES.INTERNAL_ERROR);
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

  if (message.includes('Message cannot be empty')) {
    return 'يرجى كتابة رسالة.';
  }

  if (message.includes('at most 300 characters')) {
    return 'الرسالة طويلة جداً.';
  }

  if (message.includes('Message contains invalid characters')) {
    return 'الرسالة تحتوي على رموز غير مسموحة.';
  }

  if (message.includes('invalid characters')) {
    return 'الاسم يحتوي على رموز غير مسموحة.';
  }

  return null;
}
