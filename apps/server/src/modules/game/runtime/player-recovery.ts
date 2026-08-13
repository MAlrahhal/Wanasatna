import type { Server } from 'socket.io';
import type { GameActionResponse, GameShellPlayerRecoveryPayload } from '@wanasatna/shared';
import {
  GAME_SHELL_PLAYER_RECOVERY_EVENT,
  GUESSING_CHALLENGE_GAME_ID,
} from '@wanasatna/shared';
import { resolvePlayerRecoverySeconds } from '../../../config/test-timers.js';
import { getRoomChannel } from '../../room/room.utils.js';
import { getGameShellByRoomId, syncGameShell } from '../game.service.js';
import { broadcastGameShellState, stopGameShellTimer } from '../game.timer.js';
import { abortActiveMatch } from './abort-active-match.js';
import {
  countConnectedEligibleParticipants,
  getGameMinPlayers,
} from './count-eligible-participants.js';
import { pausePhaseTimer, resumePhaseTimer } from '../plugins/bara-al-salafa/phase-timer.js';
import {
  pauseDrawGuessPhaseTimer,
  resumeDrawGuessPhaseTimer,
} from '../plugins/draw-guess/phase-timer.js';
import {
  pauseFastAnswerPhaseTimer,
  resumeFastAnswerPhaseTimer,
} from '../plugins/fast-answer/phase-timer.js';
import {
  pauseImposterDrawPhaseTimer,
  resumeImposterDrawPhaseTimer,
} from '../plugins/imposter-draw/phase-timer.js';
import {
  pauseTimingChallengePhaseTimer,
  resumeTimingChallengePhaseTimer,
} from '../plugins/timing-challenge/phase-timer.js';
import {
  pauseGuessingChallengePhaseTimer,
  resumeGuessingChallengePhaseTimer,
} from '../plugins/guessing-challenge/phase-timer.js';
import { reconcileGuessingChallengeConnectivity } from '../plugins/guessing-challenge/match-lifecycle.js';
import {
  pauseJudgePhaseTimer,
  resumeJudgePhaseTimer,
} from '../plugins/judge/phase-timer.js';
import {
  pauseWhoWroteItPhaseTimer,
  resumeWhoWroteItPhaseTimer,
} from '../plugins/who-wrote-it/phase-timer.js';

type RecoverySchedule = {
  deadlineAt: number;
  intervalId: ReturnType<typeof setInterval>;
  minimumCount: number;
};

const recoveryByRoomId = new Map<string, RecoverySchedule>();
const recoverySequenceByRoomId = new Map<string, number>();

function nextRecoverySequence(roomId: string): number {
  const next = (recoverySequenceByRoomId.get(roomId) ?? 0) + 1;
  recoverySequenceByRoomId.set(roomId, next);
  return next;
}

function currentRecoverySequence(roomId: string): number {
  return recoverySequenceByRoomId.get(roomId) ?? 0;
}

function buildRecoveryPayload(
  roomId: string,
  connectedCount: number,
  minimumCount: number,
  deadlineAt: number | null,
  sequence?: number,
): GameShellPlayerRecoveryPayload {
  const resolvedSequence = sequence ?? (deadlineAt === null ? nextRecoverySequence(roomId) : currentRecoverySequence(roomId));

  if (deadlineAt === null) {
    return {
      isActive: false,
      remainingSeconds: 0,
      connectedCount,
      minimumCount,
      sequence: resolvedSequence,
    };
  }

  const remainingSeconds = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));

  return {
    isActive: true,
    remainingSeconds,
    connectedCount,
    minimumCount,
    sequence: resolvedSequence,
  };
}

function broadcastRecoveryState(
  io: Server,
  roomId: string,
  payload: GameShellPlayerRecoveryPayload,
): void {
  io.to(getRoomChannel(roomId)).emit(GAME_SHELL_PLAYER_RECOVERY_EVENT, payload);
}

function clearRecoverySchedule(roomId: string): void {
  const schedule = recoveryByRoomId.get(roomId);

  if (!schedule) {
    return;
  }

  clearInterval(schedule.intervalId);
  recoveryByRoomId.delete(roomId);
}

/**
 * Clears an active recovery window without resuming plugin timers.
 * Use on End Game / shell teardown — resume would race cleanup.
 */
export function clearPlayerRecoveryForTeardown(io: Server, roomId: string): void {
  if (!recoveryByRoomId.has(roomId)) {
    return;
  }

  clearRecoverySchedule(roomId);
  const sequence = nextRecoverySequence(roomId);
  broadcastRecoveryState(
    io,
    roomId,
    buildRecoveryPayload(roomId, 0, 0, null, sequence),
  );
}

export function isPlayerRecoveryActive(roomId: string): boolean {
  return recoveryByRoomId.has(roomId);
}

export function playerRecoveryBlockedError(): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: {
      code: 'INVALID_PHASE',
      message: 'Match is paused while waiting for players to return.',
    },
  };
}

export function cancelPlayerRecovery(io: Server, roomId: string): void {
  if (!recoveryByRoomId.has(roomId)) {
    return;
  }

  clearRecoverySchedule(roomId);
  resumePhaseTimer(io, roomId);
  resumeDrawGuessPhaseTimer(io, roomId);
  resumeImposterDrawPhaseTimer(io, roomId);
  resumeTimingChallengePhaseTimer(io, roomId);
  resumeFastAnswerPhaseTimer(io, roomId);
  resumeWhoWroteItPhaseTimer(io, roomId);
  resumeJudgePhaseTimer(io, roomId);
  resumeGuessingChallengePhaseTimer(io, roomId);

  const shell = getGameShellByRoomId(roomId);
  const minimumCount = shell ? (getGameMinPlayers(shell.gameId) ?? 0) : 0;
  const connectedCount = shell ? countConnectedEligibleParticipants(shell) : 0;
  const sequence = nextRecoverySequence(roomId);

  broadcastRecoveryState(
    io,
    roomId,
    buildRecoveryPayload(roomId, connectedCount, minimumCount, null, sequence),
  );
}

function startRecovery(io: Server, roomId: string, connectedCount: number, minimumCount: number): void {
  if (recoveryByRoomId.has(roomId)) {
    return;
  }

  pausePhaseTimer(roomId);
  pauseDrawGuessPhaseTimer(roomId);
  pauseImposterDrawPhaseTimer(roomId);
  pauseTimingChallengePhaseTimer(roomId);
  pauseFastAnswerPhaseTimer(roomId);
  pauseWhoWroteItPhaseTimer(roomId);
  pauseJudgePhaseTimer(roomId);
  pauseGuessingChallengePhaseTimer(roomId);
  stopGameShellTimer(roomId);

  const recoverySeconds = resolvePlayerRecoverySeconds();
  const deadlineAt = Date.now() + recoverySeconds * 1000;

  const intervalId = setInterval(() => {
    void handleRecoveryTick(io, roomId);
  }, 1000);

  recoveryByRoomId.set(roomId, { deadlineAt, intervalId, minimumCount });
  const sequence = nextRecoverySequence(roomId);
  broadcastRecoveryState(
    io,
    roomId,
    buildRecoveryPayload(roomId, connectedCount, minimumCount, deadlineAt, sequence),
  );
}

async function handleRecoveryTick(io: Server, roomId: string): Promise<void> {
  const schedule = recoveryByRoomId.get(roomId);

  if (!schedule) {
    return;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'PLAYING') {
    cancelPlayerRecovery(io, roomId);
    return;
  }

  await syncGameShell(roomId);

  if (!recoveryByRoomId.has(roomId)) {
    return;
  }

  const refreshedShell = getGameShellByRoomId(roomId);

  if (!refreshedShell) {
    clearRecoverySchedule(roomId);
    return;
  }

  broadcastGameShellState(io, refreshedShell);
  reconcileGuessingChallengeConnectivity(io, roomId, refreshedShell);

  if (refreshedShell.gameId === GUESSING_CHALLENGE_GAME_ID) {
    if (isPlayerRecoveryActive(roomId)) {
      cancelPlayerRecovery(io, roomId);
    }

    return;
  }

  const connectedCount = countConnectedEligibleParticipants(refreshedShell);

  if (connectedCount >= schedule.minimumCount) {
    cancelPlayerRecovery(io, roomId);
    return;
  }

  if (Date.now() >= schedule.deadlineAt) {
    clearRecoverySchedule(roomId);
    broadcastRecoveryState(
      io,
      roomId,
      buildRecoveryPayload(roomId, connectedCount, schedule.minimumCount, null),
    );
    await abortActiveMatch(io, roomId, 'insufficient_players');
    return;
  }

  if (!recoveryByRoomId.has(roomId)) {
    return;
  }

  broadcastRecoveryState(
    io,
    roomId,
    buildRecoveryPayload(roomId, connectedCount, schedule.minimumCount, schedule.deadlineAt, currentRecoverySequence(roomId)),
  );
}

export async function evaluatePlayerRecovery(io: Server, roomId: string): Promise<void> {
  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.phase !== 'PLAYING') {
    if (isPlayerRecoveryActive(roomId)) {
      cancelPlayerRecovery(io, roomId);
    }

    return;
  }

  await syncGameShell(roomId);
  const refreshedShell = getGameShellByRoomId(roomId);

  if (!refreshedShell || refreshedShell.phase !== 'PLAYING') {
    return;
  }

  broadcastGameShellState(io, refreshedShell);
  reconcileGuessingChallengeConnectivity(io, roomId, refreshedShell);

  if (refreshedShell.gameId === GUESSING_CHALLENGE_GAME_ID) {
    if (isPlayerRecoveryActive(roomId)) {
      cancelPlayerRecovery(io, roomId);
    }

    return;
  }

  const minimumCount = getGameMinPlayers(refreshedShell.gameId);

  if (minimumCount === undefined) {
    return;
  }

  const connectedCount = countConnectedEligibleParticipants(refreshedShell);

  if (connectedCount >= minimumCount) {
    if (isPlayerRecoveryActive(roomId)) {
      cancelPlayerRecovery(io, roomId);
    }

    return;
  }

  if (!isPlayerRecoveryActive(roomId)) {
    startRecovery(io, roomId, connectedCount, minimumCount);
    return;
  }

  const schedule = recoveryByRoomId.get(roomId);

  if (schedule && recoveryByRoomId.has(roomId)) {
    broadcastRecoveryState(
      io,
      roomId,
      buildRecoveryPayload(
        roomId,
        connectedCount,
        schedule.minimumCount,
        schedule.deadlineAt,
        currentRecoverySequence(roomId),
      ),
    );
  }
}
