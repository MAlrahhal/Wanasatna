/**
 * Shared end-of-match UX copy + duration contract.
 * Plugins should reuse these so Final Results → Lobby stays consistent.
 * Adoption into remaining games happens during their P4 passes.
 */
export const MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS = 30;

export const ROUND_RESULTS_NEXT_ROUND_WAITING_MESSAGE = 'الجولة التالية تبدأ تلقائياً...';
export const ROUND_RESULTS_FINAL_WAITING_MESSAGE = 'سيتم عرض النتائج النهائية تلقائياً...';
export const ROUND_RESULTS_NEXT_CONTINUE_LABEL = 'التالي الآن';
export const ROUND_RESULTS_FINAL_CONTINUE_LABEL = 'عرض النتائج الآن';
export const MATCH_COMPLETED_RETURN_TO_LOBBY_LABEL = 'العودة إلى اللوبي';
export const MATCH_COMPLETED_WAITING_MESSAGE = 'العودة إلى اللوبي تلقائياً خلال ثوانٍ...';

export function buildRoundResultsContinueCopy(options: {
  isFinalRound: boolean;
  isHost: boolean;
}): {
  isHost: boolean;
  canContinueFromRoundResults: boolean;
  roundResultsContinueLabel: string | null;
  roundResultsWaitingMessage: string;
} {
  const { isFinalRound, isHost } = options;

  return {
    isHost,
    canContinueFromRoundResults: isHost,
    roundResultsContinueLabel: isHost
      ? isFinalRound
        ? ROUND_RESULTS_FINAL_CONTINUE_LABEL
        : ROUND_RESULTS_NEXT_CONTINUE_LABEL
      : null,
    roundResultsWaitingMessage: isFinalRound
      ? ROUND_RESULTS_FINAL_WAITING_MESSAGE
      : ROUND_RESULTS_NEXT_ROUND_WAITING_MESSAGE,
  };
}
