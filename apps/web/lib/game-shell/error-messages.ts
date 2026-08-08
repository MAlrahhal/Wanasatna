import type { GameErrorCode } from '@wanasatna/shared';

const ERROR_MESSAGES: Record<GameErrorCode, string> = {
  VALIDATION_ERROR: 'يرجى التحقق من البيانات المدخلة.',
  NOT_HOST: 'هذا الإجراء متاح للمضيف فقط.',
  NOT_IN_ROOM: 'يجب أن تكون داخل غرفة لاستخدام shell اللعبة.',
  SHELL_NOT_FOUND: 'لم يتم تهيئة shell اللعبة بعد.',
  SHELL_ALREADY_EXISTS: 'shell اللعبة موجود بالفعل في هذه الغرفة.',
  INVALID_PHASE: 'لا يمكن تنفيذ هذا الإجراء في المرحلة الحالية.',
  PLAYER_NOT_FOUND: 'تعذر العثور على اللاعب.',
  GAME_NOT_SELECTED: 'يرجى اختيار لعبة قبل البدء.',
  INTERNAL_ERROR: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
  ALREADY_SUBMITTED: 'لقد أرسلت وصفك بالفعل.',
  NOT_PARTICIPANT: 'أنت لست مشاركاً في هذه الجولة.',
  INVALID_DESCRIPTION: 'الوصف غير صالح.',
  EMPTY_DESCRIPTION: 'الوصف لا يمكن أن يكون فارغاً.',
  DESCRIPTION_TOO_LONG: 'الوصف طويل جداً.',
  NOT_ACTIVE_PLAYER: 'ليس دورك حالياً.',
  NOT_ACTIVE_ASKER: 'فقط السائل الحالي يمكنه الانتقال.',
  INVALID_TARGET: 'اللاعب المختار غير صالح.',
  PLAYER_ALREADY_COMPLETED: 'هذا اللاعب أنهى دوره بالفعل.',
  NOT_IMPOSTOR: 'فقط برا السالفة يمكنه التخمين.',
  INVALID_OPTION: 'الخيار المختار غير صالح.',
};

export function getGameShellErrorMessage(code: GameErrorCode, fallback?: string): string {
  if (fallback) {
    return fallback;
  }

  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR;
}
