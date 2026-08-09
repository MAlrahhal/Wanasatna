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
import { getGameShellByRoomId, syncGameShell } from '../game.service.js';
import { logGameShellDiagnostic } from '../game.diagnostics.js';
import { ensureBaraAlSalafaMatchStateWithTimer } from '../plugins/bara-al-salafa/init-match.js';
import { ensureDrawGuessMatchStateWithTimer } from '../plugins/draw-guess/init-match.js';
import { ensureFastAnswerMatchStateWithTimer } from '../plugins/fast-answer/init-match.js';
import { ensureGuessingChallengeMatchStateWithTimer } from '../plugins/guessing-challenge/init-match.js';
import { ensureImposterDrawMatchStateWithTimer } from '../plugins/imposter-draw/init-match.js';
import { ensureJudgeMatchStateWithTimer } from '../plugins/judge/init-match.js';
import { ensureTimingChallengeMatchStateWithTimer } from '../plugins/timing-challenge/init-match.js';
import { ensureWhoWroteItMatchStateWithTimer } from '../plugins/who-wrote-it/init-match.js';
import { abortActiveMatch } from './abort-active-match.js';

function hasConnectedMatchParticipant(
  shell: NonNullable<ReturnType<typeof getGameShellByRoomId>>,
): boolean {
  const participantIds = shell.matchParticipantIds;

  return shell.players.some(
    (player) =>
      player.isConnected && (participantIds === null || participantIds.includes(player.id)),
  );
}

async function abortBrokenMatch(io: Server, roomId: string, cause: string): Promise<void> {
  try {
    await abortActiveMatch(io, roomId, 'insufficient_players');
  } catch (abortError) {
    // The room may be left in a degraded state, but the process must survive.
    logGameShellDiagnostic('plugin-init-abort-failed', {
      roomId,
      cause,
      error: abortError instanceof Error ? abortError.message : String(abortError),
    });
  }
}

/**
 * Plugin initialization is triggered from detached lifecycle work (timers,
 * sync recovery). It must never reject: a failure aborts only the affected
 * match and the Node process keeps serving every other room.
 */
export async function initializePluginOnPlaying(io: Server, roomId: string): Promise<void> {
  try {
    await syncGameShell(roomId);

    const shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING' || !shell.gameId) {
      return;
    }

    if (
      shell.gameId !== BARA_AL_SALAFA_GAME_ID &&
      shell.gameId !== DRAW_GUESS_GAME_ID &&
      shell.gameId !== IMPOSTER_DRAW_GAME_ID &&
      shell.gameId !== TIMING_CHALLENGE_GAME_ID &&
      shell.gameId !== FAST_ANSWER_GAME_ID &&
      shell.gameId !== WHO_WROTE_IT_GAME_ID &&
      shell.gameId !== JUDGE_GAME_ID &&
      shell.gameId !== GUESSING_CHALLENGE_GAME_ID
    ) {
      return;
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
      shell.gameId === BARA_AL_SALAFA_GAME_ID
        ? ensureBaraAlSalafaMatchStateWithTimer(io, roomId)
        : shell.gameId === DRAW_GUESS_GAME_ID
          ? ensureDrawGuessMatchStateWithTimer(io, roomId)
          : shell.gameId === IMPOSTER_DRAW_GAME_ID
            ? ensureImposterDrawMatchStateWithTimer(io, roomId)
            : shell.gameId === TIMING_CHALLENGE_GAME_ID
              ? ensureTimingChallengeMatchStateWithTimer(io, roomId)
              : shell.gameId === FAST_ANSWER_GAME_ID
                ? ensureFastAnswerMatchStateWithTimer(io, roomId)
                : shell.gameId === WHO_WROTE_IT_GAME_ID
                  ? ensureWhoWroteItMatchStateWithTimer(io, roomId)
                  : shell.gameId === JUDGE_GAME_ID
                    ? ensureJudgeMatchStateWithTimer(io, roomId)
                    : shell.gameId === GUESSING_CHALLENGE_GAME_ID
                      ? ensureGuessingChallengeMatchStateWithTimer(io, roomId)
                      : null;

    if (!match) {
      logGameShellDiagnostic('plugin-init-no-match-state', {
        roomId,
        shellId: shell.shellId,
        gameId: shell.gameId,
      });
      await abortBrokenMatch(io, roomId, 'no-match-state');
    }
  } catch (error) {
    logGameShellDiagnostic('plugin-init-failed', {
      roomId,
      error: error instanceof Error ? error.message : String(error),
    });
    await abortBrokenMatch(io, roomId, 'init-error');
  }
}
