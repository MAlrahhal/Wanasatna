import {
  BARA_AL_SALAFA_GAME_ID,
  DRAW_GUESS_GAME_ID,
  FAST_ANSWER_GAME_ID,
  IMPOSTER_DRAW_GAME_ID,
  TIMING_CHALLENGE_GAME_ID,
} from '@wanasatna/shared';
import { stopPhaseTimer } from '../plugins/bara-al-salafa/phase-timer.js';
import { deleteBaraAlSalafaState } from '../plugins/bara-al-salafa/store.js';
import { clearRoomRoundCategory } from './round-category-store.js';
import { stopDrawGuessPhaseTimer } from '../plugins/draw-guess/phase-timer.js';
import { deleteDrawGuessState } from '../plugins/draw-guess/store.js';
import { clearFastAnswerPhaseTimerRuntime } from '../plugins/fast-answer/phase-timer.js';
import { deleteFastAnswerState } from '../plugins/fast-answer/store.js';
import { stopImposterDrawPhaseTimer } from '../plugins/imposter-draw/phase-timer.js';
import { deleteImposterDrawState } from '../plugins/imposter-draw/store.js';
import { clearTimingChallengePhaseTimerRuntime } from '../plugins/timing-challenge/phase-timer.js';
import {
  clearTimingChallengeSettings,
  deleteTimingChallengeState,
} from '../plugins/timing-challenge/store.js';

export function cleanupPluginMatchState(roomId: string, gameId: string | null): void {
  clearRoomRoundCategory(roomId);

  if (gameId === BARA_AL_SALAFA_GAME_ID) {
    stopPhaseTimer(roomId);
    deleteBaraAlSalafaState(roomId);
  }

  if (gameId === DRAW_GUESS_GAME_ID) {
    stopDrawGuessPhaseTimer(roomId);
    deleteDrawGuessState(roomId);
  }

  if (gameId === IMPOSTER_DRAW_GAME_ID) {
    stopImposterDrawPhaseTimer(roomId);
    deleteImposterDrawState(roomId);
  }

  if (gameId === TIMING_CHALLENGE_GAME_ID) {
    clearTimingChallengePhaseTimerRuntime(roomId);
    deleteTimingChallengeState(roomId);
    clearTimingChallengeSettings(roomId);
  }

  if (gameId === FAST_ANSWER_GAME_ID) {
    clearFastAnswerPhaseTimerRuntime(roomId);
    deleteFastAnswerState(roomId);
  }
}
