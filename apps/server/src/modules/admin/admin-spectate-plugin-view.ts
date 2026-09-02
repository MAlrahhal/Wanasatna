import type { AdminSpectatePluginView } from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_GAME_ID,
  DRAW_GUESS_GAME_ID,
  FAST_ANSWER_GAME_ID,
  GUESSING_CHALLENGE_GAME_ID,
  IMPOSTER_DRAW_GAME_ID,
  JUDGE_GAME_ID,
  TIMING_CHALLENGE_GAME_ID,
  WHO_WROTE_IT_GAME_ID,
  type GameShellState,
} from '@wanasatna/shared';
import { getGameShellByRoomId } from '../game/game.service.js';
import { buildBaraAlSalafaSpectatorView } from '../game/plugins/bara-al-salafa/state.js';
import { getBaraAlSalafaState } from '../game/plugins/bara-al-salafa/store.js';
import { buildDrawGuessSpectatorView } from '../game/plugins/draw-guess/state.js';
import { getDrawGuessState } from '../game/plugins/draw-guess/store.js';
import { buildFastAnswerPlayerView } from '../game/plugins/fast-answer/state.js';
import { getFastAnswerState } from '../game/plugins/fast-answer/store.js';
import { buildGuessingChallengePlayerView } from '../game/plugins/guessing-challenge/state.js';
import { getGuessingChallengeState } from '../game/plugins/guessing-challenge/store.js';
import { buildImposterDrawSpectatorView } from '../game/plugins/imposter-draw/state.js';
import { getImposterDrawState } from '../game/plugins/imposter-draw/store.js';
import { buildJudgePlayerView } from '../game/plugins/judge/state.js';
import { getJudgeState } from '../game/plugins/judge/store.js';
import { buildTimingChallengeSpectatorView } from '../game/plugins/timing-challenge/state.js';
import { getTimingChallengeState } from '../game/plugins/timing-challenge/store.js';
import { buildWhoWroteItPlayerView } from '../game/plugins/who-wrote-it/state.js';
import { getWhoWroteItState } from '../game/plugins/who-wrote-it/store.js';

/** Never a real Player id; used only to request existing spectator-filtered views. */
const ADMIN_SPECTATE_VIEWER_ID = '__wanasatna_admin_spectate__';

function toPluginView(gameId: string, view: unknown): AdminSpectatePluginView | null {
  if (!view || typeof view !== 'object' || Array.isArray(view)) {
    return null;
  }

  try {
    return {
      gameId,
      view: JSON.parse(JSON.stringify(view)) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

export function buildAdminSpectatePluginView(
  roomId: string,
  shell: GameShellState | null = getGameShellByRoomId(roomId),
): AdminSpectatePluginView | null {
  if (!shell?.gameId) {
    return null;
  }

  try {
    switch (shell.gameId) {
      case BARA_AL_SALAFA_GAME_ID: {
        const match = getBaraAlSalafaState(roomId);
        return match ? toPluginView(shell.gameId, buildBaraAlSalafaSpectatorView(match)) : null;
      }
      case DRAW_GUESS_GAME_ID: {
        const match = getDrawGuessState(roomId);
        return match ? toPluginView(shell.gameId, buildDrawGuessSpectatorView(match)) : null;
      }
      case IMPOSTER_DRAW_GAME_ID: {
        const match = getImposterDrawState(roomId);
        return match ? toPluginView(shell.gameId, buildImposterDrawSpectatorView(match)) : null;
      }
      case TIMING_CHALLENGE_GAME_ID: {
        const match = getTimingChallengeState(roomId);
        return match ? toPluginView(shell.gameId, buildTimingChallengeSpectatorView(match)) : null;
      }
      case FAST_ANSWER_GAME_ID: {
        const match = getFastAnswerState(roomId);
        return match
          ? toPluginView(
              shell.gameId,
              buildFastAnswerPlayerView(match, ADMIN_SPECTATE_VIEWER_ID, shell),
            )
          : null;
      }
      case WHO_WROTE_IT_GAME_ID: {
        const match = getWhoWroteItState(roomId);
        return match
          ? toPluginView(
              shell.gameId,
              buildWhoWroteItPlayerView(match, ADMIN_SPECTATE_VIEWER_ID, shell),
            )
          : null;
      }
      case JUDGE_GAME_ID: {
        const match = getJudgeState(roomId);
        return match
          ? toPluginView(shell.gameId, buildJudgePlayerView(match, ADMIN_SPECTATE_VIEWER_ID, shell))
          : null;
      }
      case GUESSING_CHALLENGE_GAME_ID: {
        const match = getGuessingChallengeState(roomId);
        return match
          ? toPluginView(
              shell.gameId,
              buildGuessingChallengePlayerView(match, ADMIN_SPECTATE_VIEWER_ID, shell),
            )
          : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
