import type { Server } from 'socket.io';
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
import { sanitizeErrorName, sanitizeKnownErrorCode } from '../../../lib/ops-logger.js';
import { reconcileActivePersistedMatchParticipants } from '../../match/match-history.service.js';
import {
  getGameShellByRoomId,
  reconcileUninitializedMatchParticipants,
  syncGameShell,
} from '../game.service.js';
import { broadcastGameShellState } from '../game.timer.js';
import { logGameShellDiagnostic } from '../game.diagnostics.js';
import { ensureBaraAlSalafaMatchStateWithTimer } from '../plugins/bara-al-salafa/init-match.js';
import { getBaraAlSalafaState } from '../plugins/bara-al-salafa/store.js';
import { ensureDrawGuessMatchStateWithTimer } from '../plugins/draw-guess/init-match.js';
import { getDrawGuessState } from '../plugins/draw-guess/store.js';
import { ensureFastAnswerMatchStateWithTimer } from '../plugins/fast-answer/init-match.js';
import { getFastAnswerState } from '../plugins/fast-answer/store.js';
import { ensureGuessingChallengeMatchStateWithTimer } from '../plugins/guessing-challenge/init-match.js';
import { getGuessingChallengeState } from '../plugins/guessing-challenge/store.js';
import { ensureImposterDrawMatchStateWithTimer } from '../plugins/imposter-draw/init-match.js';
import { getImposterDrawState } from '../plugins/imposter-draw/store.js';
import { ensureJudgeMatchStateWithTimer } from '../plugins/judge/init-match.js';
import { getJudgeState } from '../plugins/judge/store.js';
import { ensureTimingChallengeMatchStateWithTimer } from '../plugins/timing-challenge/init-match.js';
import { getTimingChallengeState } from '../plugins/timing-challenge/store.js';
import { ensureWhoWroteItMatchStateWithTimer } from '../plugins/who-wrote-it/init-match.js';
import { getWhoWroteItState } from '../plugins/who-wrote-it/store.js';
import { abortActiveMatch } from './abort-active-match.js';
import { pluginParticipantsMatchShell } from './plugin-participant-invariant.js';
import { getGamePluginDefinition } from './plugin-registry.js';

function hasConnectedMatchParticipant(
  shell: NonNullable<ReturnType<typeof getGameShellByRoomId>>,
): boolean {
  const participantIds = shell.matchParticipantIds;

  return shell.players.some(
    (player) =>
      player.isConnected && (participantIds === null || participantIds.includes(player.id)),
  );
}

function hasInitializedPluginState(roomId: string, gameId: string): boolean {
  if (gameId === BARA_AL_SALAFA_GAME_ID) {
    return getBaraAlSalafaState(roomId) !== null;
  }
  if (gameId === DRAW_GUESS_GAME_ID) {
    return getDrawGuessState(roomId) !== null;
  }
  if (gameId === IMPOSTER_DRAW_GAME_ID) {
    return getImposterDrawState(roomId) !== null;
  }
  if (gameId === TIMING_CHALLENGE_GAME_ID) {
    return getTimingChallengeState(roomId) !== null;
  }
  if (gameId === FAST_ANSWER_GAME_ID) {
    return getFastAnswerState(roomId) !== null;
  }
  if (gameId === WHO_WROTE_IT_GAME_ID) {
    return getWhoWroteItState(roomId) !== null;
  }
  if (gameId === JUDGE_GAME_ID) {
    return getJudgeState(roomId) !== null;
  }
  if (gameId === GUESSING_CHALLENGE_GAME_ID) {
    return getGuessingChallengeState(roomId) !== null;
  }
  return false;
}

async function abortBrokenMatch(io: Server, roomId: string, cause: string): Promise<void> {
  try {
    await abortActiveMatch(io, roomId, 'insufficient_players');
  } catch (abortError) {
    // The room may be left in a degraded state, but the process must survive.
    logGameShellDiagnostic('plugin-init-abort-failed', {
      roomId,
      cause,
      errorName: sanitizeErrorName(abortError),
      errorCode: sanitizeKnownErrorCode(abortError),
    });
  }
}

/**
 * Plugin initialization is triggered from detached lifecycle work (timers,
 * sync recovery). It must never reject: a failure aborts only the affected
 * match and the Node process keeps serving every other room.
 */
export async function initializePluginOnPlaying(
  io: Server,
  roomId: string,
  expectedShellId?: string,
): Promise<void> {
  try {
    await syncGameShell(roomId);

    let shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING' || !shell.gameId) {
      return;
    }
    const gameId = shell.gameId;

    // Stale async work from a disposed shell must not initialize a later match.
    if (expectedShellId && shell.shellId !== expectedShellId) {
      logGameShellDiagnostic('plugin-init-stale-shell', {
        roomId,
        expectedShellId,
        currentShellId: shell.shellId,
      });
      return;
    }

    if (
      gameId !== BARA_AL_SALAFA_GAME_ID &&
      gameId !== DRAW_GUESS_GAME_ID &&
      gameId !== IMPOSTER_DRAW_GAME_ID &&
      gameId !== TIMING_CHALLENGE_GAME_ID &&
      gameId !== FAST_ANSWER_GAME_ID &&
      gameId !== WHO_WROTE_IT_GAME_ID &&
      gameId !== JUDGE_GAME_ID &&
      gameId !== GUESSING_CHALLENGE_GAME_ID
    ) {
      return;
    }

    if (!hasInitializedPluginState(roomId, gameId)) {
      const reconciled = reconcileUninitializedMatchParticipants(roomId);
      if (reconciled) {
        shell = reconciled;
        await reconcileActivePersistedMatchParticipants(roomId, shell.matchParticipantIds ?? []);
        broadcastGameShellState(io, shell);
      }

      const minimumPlayers = getGamePluginDefinition(gameId)?.minPlayers;
      if (
        minimumPlayers !== undefined &&
        (shell.matchParticipantIds?.length ?? 0) < minimumPlayers
      ) {
        await abortBrokenMatch(io, roomId, 'insufficient-locked-participants');
        return;
      }
    }

    if (!hasConnectedMatchParticipant(shell)) {
      logGameShellDiagnostic('plugin-init-no-connected-participants', {
        roomId,
        shellId: shell.shellId,
        gameId: shell.gameId,
      });
      await abortBrokenMatch(io, roomId, 'no-connected-participants');
      return;
    }

    const match =
      gameId === BARA_AL_SALAFA_GAME_ID
        ? ensureBaraAlSalafaMatchStateWithTimer(io, roomId)
        : gameId === DRAW_GUESS_GAME_ID
          ? ensureDrawGuessMatchStateWithTimer(io, roomId)
          : gameId === IMPOSTER_DRAW_GAME_ID
            ? ensureImposterDrawMatchStateWithTimer(io, roomId)
            : gameId === TIMING_CHALLENGE_GAME_ID
              ? ensureTimingChallengeMatchStateWithTimer(io, roomId)
              : gameId === FAST_ANSWER_GAME_ID
                ? ensureFastAnswerMatchStateWithTimer(io, roomId)
                : gameId === WHO_WROTE_IT_GAME_ID
                  ? ensureWhoWroteItMatchStateWithTimer(io, roomId)
                  : gameId === JUDGE_GAME_ID
                    ? ensureJudgeMatchStateWithTimer(io, roomId)
                    : gameId === GUESSING_CHALLENGE_GAME_ID
                      ? ensureGuessingChallengeMatchStateWithTimer(io, roomId)
                      : null;

    if (!match) {
      logGameShellDiagnostic('plugin-init-no-match-state', {
        roomId,
        shellId: shell.shellId,
        gameId: shell.gameId,
      });
      await abortBrokenMatch(io, roomId, 'no-match-state');
      return;
    }

    if (!pluginParticipantsMatchShell(shell, match.playerIds)) {
      await abortBrokenMatch(io, roomId, 'participant-mismatch');
    }
  } catch (error) {
    logGameShellDiagnostic('plugin-init-failed', {
      roomId,
      errorName: sanitizeErrorName(error),
      errorCode: sanitizeKnownErrorCode(error),
    });
    await abortBrokenMatch(io, roomId, 'init-error');
  }
}
