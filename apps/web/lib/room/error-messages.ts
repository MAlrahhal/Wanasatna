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
  ROOM_CODE_GENERATION_FAILED: 'تعذر إنشاء رمز الغرفة. حاول مرة أخرى.',
  INTERNAL_ERROR: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
};

export function getRoomErrorMessage(code: RoomErrorCode, fallback?: string): string {
  return ERROR_MESSAGES[code] ?? fallback ?? ERROR_MESSAGES.INTERNAL_ERROR;
}
