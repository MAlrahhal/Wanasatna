export const SYSTEM_COPY = {
  loading: 'جاري التحميل…',
  connecting: 'جاري الاتصال بالغرفة…',
  reconnecting: 'جاري إعادة الاتصال…',
  recovered: 'تمت إعادة الاتصال.',
  genericError: 'حدث خطأ',
  unexpectedError: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
  gameLoadFailed: 'تعذر تحميل اللعبة.',
  gameLoadFailedHelper: 'تحقق من اتصالك وحاول مرة ثانية.',
  retry: 'إعادة المحاولة',
  backHome: 'العودة إلى الرئيسية',
  backLobby: 'العودة إلى اللوبي',
  leave: 'مغادرة الغرفة',
  leaveConfirmTitle: 'مغادرة الغرفة؟',
  leaveConfirmBody: 'هل أنت متأكد أنك تريد مغادرة الغرفة؟',
  cancel: 'إلغاء',
  kickedTitle: 'تم طردك من الغرفة',
  kickedHelper: 'لم يعد بإمكانك الانضمام إلى هذه الغرفة من الجلسة الحالية.',
  roomMissing: 'الغرفة غير موجودة.',
  roomClosed: 'هذه الغرفة مغلقة.',
  roomFull: 'الغرفة ممتلئة.',
  roomFullHelper: 'لا يمكن الانضمام حالياً لأن الغرفة وصلت للحد الأقصى.',
  roomLocked: 'الغرفة مقفلة حالياً.',
  reconnectExpired: 'انتهت مهلة إعادة الاتصال. يرجى الانضمام من جديد.',
  gameUnavailable: 'اللعبة غير متاحة حالياً.',
  returningToLobby: 'جاري العودة إلى اللوبي…',
  gameEndedReturnLobby: 'انتهت الجولة أو تمت إعادة تشغيل اللعبة، ورجعناك إلى اللوبي.',
  spectator: 'أنت مشاهد حالياً.',
  copiedLink: 'تم نسخ الرابط',
  leaving: 'جاري المغادرة…',
  spectatorTitle: 'مشاهدة',
  nextRoundAuto: 'الجولة التالية تبدأ تلقائياً…',
  finalResultsAuto: 'سيتم عرض النتائج النهائية تلقائياً…',
} as const;

export function presentSystemCopy(text: string | null | undefined, fallback = ''): string {
  return (text?.trim() || fallback).replace(/\.{3}/g, '…');
}

export function copyLinkFailedMessage(url: string): string {
  return `تعذر نسخ الرابط. انسخه يدوياً من هنا: ${url}`;
}

const TECHNICAL_ERROR =
  /socket|prisma|econn|etimedout|typeerror|internal_error|validation_error|stack|undefined is not|cannot read/i;

export function toSafeUserErrorMessage(
  message: string | null | undefined,
  fallback: string = SYSTEM_COPY.unexpectedError,
): string {
  const trimmed = message?.trim() ?? '';
  if (!trimmed || TECHNICAL_ERROR.test(trimmed) || /^[A-Z][A-Z0-9_]+$/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

export function presentRoomActionError(message: string | null | undefined): {
  title: string;
  description?: string;
} {
  const safe = toSafeUserErrorMessage(message);

  if (safe === SYSTEM_COPY.roomFull || safe.startsWith(SYSTEM_COPY.roomFull)) {
    return { title: SYSTEM_COPY.roomFull, description: SYSTEM_COPY.roomFullHelper };
  }

  if (safe === SYSTEM_COPY.roomLocked || safe.includes('الغرفة مقفلة')) {
    return { title: SYSTEM_COPY.roomLocked };
  }

  if (safe === SYSTEM_COPY.roomMissing) {
    return { title: SYSTEM_COPY.roomMissing };
  }

  if (safe === SYSTEM_COPY.roomClosed) {
    return { title: SYSTEM_COPY.roomClosed };
  }

  if (safe === SYSTEM_COPY.kickedTitle || safe.startsWith(SYSTEM_COPY.kickedTitle)) {
    return { title: SYSTEM_COPY.kickedTitle, description: SYSTEM_COPY.kickedHelper };
  }

  if (safe.includes('إعادة الاتصال')) {
    return { title: SYSTEM_COPY.reconnectExpired };
  }

  if (safe === SYSTEM_COPY.gameEndedReturnLobby) {
    return { title: SYSTEM_COPY.gameEndedReturnLobby };
  }

  if (safe === SYSTEM_COPY.gameLoadFailed) {
    return {
      title: SYSTEM_COPY.gameLoadFailed,
      description: SYSTEM_COPY.gameLoadFailedHelper,
    };
  }

  return { title: SYSTEM_COPY.genericError, description: safe };
}
