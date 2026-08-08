import {
  BARA_AL_SALAFA_GAME_ID,
  DRAW_GUESS_GAME_ID,
  IMPOSTER_DRAW_GAME_ID,
} from '@wanasatna/shared';
import { stopPhaseTimer } from '../plugins/bara-al-salafa/phase-timer.js';
import { deleteBaraAlSalafaState } from '../plugins/bara-al-salafa/store.js';
import { clearRoomRoundCategory } from './round-category-store.js';
import { stopDrawGuessPhaseTimer } from '../plugins/draw-guess/phase-timer.js';
import { deleteDrawGuessState } from '../plugins/draw-guess/store.js';
import { stopImposterDrawPhaseTimer } from '../plugins/imposter-draw/phase-timer.js';
import { deleteImposterDrawState } from '../plugins/imposter-draw/store.js';

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
}
