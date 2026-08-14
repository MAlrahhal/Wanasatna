import type { GameErrorCode } from '@wanasatna/shared';
import { toSafeUserErrorMessage } from '@/lib/ui/system-copy';

const ERROR_MESSAGES: Record<GameErrorCode, string> = {
  VALIDATION_ERROR: 'يرجى التحقق من البيانات المدخلة.',
  NOT_HOST: 'هذا الإجراء متاح للمضيف فقط.',
  NOT_IN_ROOM: 'يجب أن تكون داخل غرفة.',
  SHELL_NOT_FOUND: 'لم يتم تهيئة اللعبة بعد.',
  SHELL_ALREADY_EXISTS: 'اللعبة جاهزة بالفعل في هذه الغرفة.',
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
  TEAM_NOT_SUPPORTED: 'هذه اللعبة لا تدعم توزيع الفرق.',
  TEAM_FULL: 'هذا الفريق ممتلئ.',
  INVALID_TEAM_ASSIGNMENT: 'توزيع الفرق غير مكتمل أو غير صالح.',
  PLAYER_NOT_ELIGIBLE: 'هذا اللاعب غير مؤهل لتوزيع الفرق.',
};

export function getGameShellErrorMessage(code: GameErrorCode, fallback?: string): string {
  const mapped = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR;
  if (code === 'VALIDATION_ERROR' && fallback) {
    return toSafeUserErrorMessage(fallback, mapped);
  }

  return mapped;
}
