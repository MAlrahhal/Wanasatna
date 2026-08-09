import type { Server } from 'socket.io';
import type { JudgeMatchState } from '@wanasatna/shared';
import { JUDGE_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { completeMatch } from './match-lifecycle.js';
import { withRound } from './state.js';
import { getJudgeState, setJudgeState } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setInterval>>();
const pausedRoomIds = new Set<string>();

const TIMERLESS_PHASES = new Set<JudgeMatchState['round']['gamePhase']>([
  'answering',
  'judging',
  'round-results',
]);

export function pauseJudgePhaseTimer(roomId: string): void {
  pausedRoomIds.add(roomId);
  stopJudgePhaseTimer(roomId);
}

export function resumeJudgePhaseTimer(io: Server, roomId: string): void {
  pausedRoomIds.delete(roomId);
  startJudgePhaseTimerIfNeeded(io, roomId);
}

export function stopJudgePhaseTimer(roomId: string): void {
  const intervalId = timersByRoomId.get(roomId);

  if (intervalId) {
    clearInterval(intervalId);
    timersByRoomId.delete(roomId);
  }
}

export function clearJudgePhaseTimerRuntime(roomId: string): void {
  stopJudgePhaseTimer(roomId);
  pausedRoomIds.delete(roomId);
}

export function startJudgePhaseTimerIfNeeded(io: Server, roomId: string): void {
  if (pausedRoomIds.has(roomId) || timersByRoomId.has(roomId)) {
    return;
  }

  const match = getJudgeState(roomId);

  if (!match || TIMERLESS_PHASES.has(match.round.gamePhase)) {
    return;
  }

  if (match.round.phaseRemainingSeconds <= 0 && match.round.gamePhase === 'match-completed') {
    completeMatch(io, roomId);
    return;
  }

  const intervalId = setInterval(() => {
    const currentMatch = getJudgeState(roomId);

    if (!currentMatch || TIMERLESS_PHASES.has(currentMatch.round.gamePhase)) {
      stopJudgePhaseTimer(roomId);
      return;
    }

    const shell = getGameShellByRoomId(roomId);

    if (!shell || shell.phase !== 'PLAYING') {
      stopJudgePhaseTimer(roomId);
      return;
    }

    const remainingSeconds = Math.max(0, currentMatch.round.phaseRemainingSeconds - 1);
    const nextMatch = withRound(currentMatch, {
      ...currentMatch.round,
      phaseRemainingSeconds: remainingSeconds,
    });

    setJudgeState(roomId, nextMatch);
    io.to(getRoomChannel(roomId)).emit(JUDGE_PHASE_CHANGED_EVENT, {});

    if (remainingSeconds <= 0 && currentMatch.round.gamePhase === 'match-completed') {
      completeMatch(io, roomId);
    }
  }, 1000);

  timersByRoomId.set(roomId, intervalId);
}
