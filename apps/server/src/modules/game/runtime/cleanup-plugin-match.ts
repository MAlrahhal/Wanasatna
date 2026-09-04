import {
  BARA_AL_SALAFA_GAME_ID,
  DRAW_GUESS_GAME_ID,
  FAST_ANSWER_GAME_ID,
  IMPOSTER_DRAW_GAME_ID,
  GUESSING_CHALLENGE_GAME_ID,
  JUDGE_GAME_ID,
  TIMING_CHALLENGE_GAME_ID,
  WHO_WROTE_IT_GAME_ID,
} from '@wanasatna/shared';
import { clearPhaseTimerRuntime } from '../plugins/bara-al-salafa/phase-timer.js';
import { deleteBaraAlSalafaState } from '../plugins/bara-al-salafa/store.js';
import { clearRoomRoundCategory } from './round-category-store.js';
import { clearDrawGuessPhaseTimerRuntime } from '../plugins/draw-guess/phase-timer.js';
import { deleteDrawGuessState } from '../plugins/draw-guess/store.js';
import { clearDrawGuessRoomDrawerSettings } from '../plugins/draw-guess/drawer-mode-store.js';
import { clearFastAnswerPhaseTimerRuntime } from '../plugins/fast-answer/phase-timer.js';
import { deleteFastAnswerState } from '../plugins/fast-answer/store.js';
import { clearGuessingChallengePhaseTimerRuntime } from '../plugins/guessing-challenge/phase-timer.js';
import { clearGuessingChallengeRoomMode } from '../plugins/guessing-challenge/mode-store.js';
import { clearLookThrottleForRoom } from '../plugins/guessing-challenge/state.js';
import { deleteGuessingChallengeState } from '../plugins/guessing-challenge/store.js';
import { clearImposterDrawPhaseTimerRuntime } from '../plugins/imposter-draw/phase-timer.js';
import { deleteImposterDrawState } from '../plugins/imposter-draw/store.js';
import { clearJudgePhaseTimerRuntime } from '../plugins/judge/phase-timer.js';
import { deleteJudgeState } from '../plugins/judge/store.js';
import { clearTimingChallengePhaseTimerRuntime } from '../plugins/timing-challenge/phase-timer.js';
import {
  clearTimingChallengeSettings,
  deleteTimingChallengeState,
} from '../plugins/timing-challenge/store.js';
import { clearWhoWroteItPhaseTimerRuntime } from '../plugins/who-wrote-it/phase-timer.js';
import { deleteWhoWroteItState } from '../plugins/who-wrote-it/store.js';

export function cleanupPluginMatchState(roomId: string, gameId: string | null): void {
  // Match teardown (abort, rematch, marathon game switch) must not clear
  // room content history. That map is removed only in onRoomDeleted.
  clearRoomRoundCategory(roomId);

  if (gameId === BARA_AL_SALAFA_GAME_ID) {
    clearPhaseTimerRuntime(roomId);
    deleteBaraAlSalafaState(roomId);
  }

  if (gameId === DRAW_GUESS_GAME_ID) {
    clearDrawGuessPhaseTimerRuntime(roomId);
    deleteDrawGuessState(roomId);
    clearDrawGuessRoomDrawerSettings(roomId);
  }

  if (gameId === IMPOSTER_DRAW_GAME_ID) {
    clearImposterDrawPhaseTimerRuntime(roomId);
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

  if (gameId === WHO_WROTE_IT_GAME_ID) {
    clearWhoWroteItPhaseTimerRuntime(roomId);
    deleteWhoWroteItState(roomId);
  }

  if (gameId === JUDGE_GAME_ID) {
    clearJudgePhaseTimerRuntime(roomId);
    deleteJudgeState(roomId);
  }

  if (gameId === GUESSING_CHALLENGE_GAME_ID) {
    // Match natural completeMatch: timers + look + room mode + match state.
    clearGuessingChallengePhaseTimerRuntime(roomId);
    clearLookThrottleForRoom(roomId);
    clearGuessingChallengeRoomMode(roomId);
    deleteGuessingChallengeState(roomId);
  }
}
