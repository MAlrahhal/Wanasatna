import type { Server } from 'socket.io';
import { SECRET_AGENTS_GAME_ID } from '@wanasatna/shared';
import { getRoomChannel, RECONNECT_WINDOW_MS } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import {
  expireSecretAgentsPhase,
  expireSecretAgentsRecovery,
  pauseSecretAgentsMatch,
  resumeSecretAgentsMatch,
} from './state.js';
import { getSecretAgentsMatch, setSecretAgentsMatch } from './store.js';
import { completeSecretAgentsMatch } from './match-lifecycle.js';
import { SECRET_AGENTS_PHASE_CHANGED_EVENT } from '@wanasatna/shared';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const generationsByRoomId = new Map<string, number>();
const resultsDeadlineByRoomId = new Map<string, number>();
const RESULTS_SECONDS = 12;

function connectedEligibleActorExists(roomId: string): boolean {
  const shell = getGameShellByRoomId(roomId);
  const match = getSecretAgentsMatch(roomId);
  if (!shell || !match) return false;
  const requiredPhase = match.phase === 'paused' ? match.pausedFromPhase : match.phase;
  const requiredRole = requiredPhase === 'clue' ? 'spymaster' : 'operative';
  if (requiredPhase !== 'clue' && requiredPhase !== 'guessing') return true;
  const connected = new Set(
    shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );
  return Object.entries(match.assignments).some(
    ([playerId, assignment]) =>
      connected.has(playerId) &&
      assignment.team === match.activeTeam &&
      assignment.role === requiredRole,
  );
}

export function stopSecretAgentsTimer(roomId: string): void {
  const timer = timersByRoomId.get(roomId);
  if (timer) clearTimeout(timer);
  timersByRoomId.delete(roomId);
}

export function clearSecretAgentsTimerRuntime(roomId: string): void {
  stopSecretAgentsTimer(roomId);
  generationsByRoomId.delete(roomId);
  resultsDeadlineByRoomId.delete(roomId);
}

function schedule(io: Server, roomId: string): void {
  stopSecretAgentsTimer(roomId);
  const match = getSecretAgentsMatch(roomId);
  if (!match) return;
  const generation = (generationsByRoomId.get(roomId) ?? 0) + 1;
  generationsByRoomId.set(roomId, generation);

  let deadlineAtMs: number | null = match.deadlineAtMs;
  if (match.phase === 'paused') deadlineAtMs = match.recoveryDeadlineAtMs;
  if (match.phase === 'completed') {
    deadlineAtMs = resultsDeadlineByRoomId.get(roomId) ?? Date.now() + RESULTS_SECONDS * 1000;
    resultsDeadlineByRoomId.set(roomId, deadlineAtMs);
  }
  if (deadlineAtMs === null) return;

  const expectedTurnId = match.turnId;
  const expectedPhase = match.phase;
  const delay = Math.max(0, deadlineAtMs - Date.now());
  timersByRoomId.set(
    roomId,
    setTimeout(() => {
      if (generationsByRoomId.get(roomId) !== generation) return;
      timersByRoomId.delete(roomId);
      const current = getSecretAgentsMatch(roomId);
      if (!current || current.turnId !== expectedTurnId || current.phase !== expectedPhase) return;

      if (current.phase === 'completed') {
        completeSecretAgentsMatch(io, roomId);
        return;
      }
      if (current.phase === 'paused') {
        if (connectedEligibleActorExists(roomId)) {
          setSecretAgentsMatch(roomId, resumeSecretAgentsMatch(current));
        } else {
          setSecretAgentsMatch(roomId, expireSecretAgentsRecovery(current));
        }
      } else {
        const expired = expireSecretAgentsPhase(current, expectedTurnId, current.phase);
        if (expired) setSecretAgentsMatch(roomId, expired);
      }
      io.to(getRoomChannel(roomId)).emit(SECRET_AGENTS_PHASE_CHANGED_EVENT, {});
      reconcileSecretAgentsConnectivity(io, roomId);
    }, delay),
  );
}

export function restartSecretAgentsTimer(io: Server, roomId: string): void {
  schedule(io, roomId);
}

export function settleSecretAgentsDeadline(io: Server, roomId: string, now = Date.now()): boolean {
  const match = getSecretAgentsMatch(roomId);
  if (
    !match ||
    (match.phase !== 'clue' && match.phase !== 'guessing') ||
    match.deadlineAtMs === null ||
    now < match.deadlineAtMs
  ) {
    return false;
  }
  const expired = expireSecretAgentsPhase(match, match.turnId, match.phase, now);
  if (!expired) return false;
  setSecretAgentsMatch(roomId, expired);
  io.to(getRoomChannel(roomId)).emit(SECRET_AGENTS_PHASE_CHANGED_EVENT, {});
  reconcileSecretAgentsConnectivity(io, roomId);
  return true;
}

export function reconcileSecretAgentsConnectivity(io: Server, roomId: string): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getSecretAgentsMatch(roomId);
  if (!shell || shell.gameId !== SECRET_AGENTS_GAME_ID || !match) return;
  if (match.phase === 'completed') {
    schedule(io, roomId);
    return;
  }

  const available = connectedEligibleActorExists(roomId);
  if (match.phase === 'paused') {
    if (available) {
      setSecretAgentsMatch(roomId, resumeSecretAgentsMatch(match));
      io.to(getRoomChannel(roomId)).emit(SECRET_AGENTS_PHASE_CHANGED_EVENT, {});
    } else if (match.recoveryDeadlineAtMs !== null && Date.now() >= match.recoveryDeadlineAtMs) {
      setSecretAgentsMatch(roomId, expireSecretAgentsRecovery(match));
      io.to(getRoomChannel(roomId)).emit(SECRET_AGENTS_PHASE_CHANGED_EVENT, {});
    }
    schedule(io, roomId);
    return;
  }

  if (!available && (match.phase === 'clue' || match.phase === 'guessing')) {
    const reason = match.phase === 'clue' ? 'missing-spymaster' : 'missing-operative';
    setSecretAgentsMatch(
      roomId,
      pauseSecretAgentsMatch(match, reason, Date.now() + RECONNECT_WINDOW_MS),
    );
    io.to(getRoomChannel(roomId)).emit(SECRET_AGENTS_PHASE_CHANGED_EVENT, {});
  }
  schedule(io, roomId);
}
