import type { Server } from 'socket.io';
import { EYEWITNESS_GAME_ID, EYEWITNESS_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { absorbSpectatorsAndExpandMatch } from '../../runtime/absorb-spectators-for-next-round.js';
import { completeEyewitnessMatchLifecycle } from './match-lifecycle.js';
import {
  advanceEyewitnessRound,
  beginEyewitnessVoting,
  expireEyewitnessPhase,
  handleEyewitnessPermanentLeave,
  reconcileEyewitnessWitnessConnection,
} from './state.js';
import { getEyewitnessMatch, setEyewitnessMatch } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const generationsByRoomId = new Map<string, number>();

export function stopEyewitnessTimer(roomId: string): void {
  const timer = timersByRoomId.get(roomId);
  if (timer) clearTimeout(timer);
  timersByRoomId.delete(roomId);
}

export function clearEyewitnessTimerRuntime(roomId: string): void {
  stopEyewitnessTimer(roomId);
  generationsByRoomId.delete(roomId);
}

function broadcast(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(EYEWITNESS_PHASE_CHANGED_EVENT, {});
}

function isWitnessConnected(roomId: string, witnessPlayerId: string): boolean {
  return (
    getGameShellByRoomId(roomId)?.players.some(
      (player) => player.id === witnessPlayerId && player.isConnected,
    ) === true
  );
}

export function advanceEyewitnessAtBoundary(
  io: Server,
  roomId: string,
  requestId: string | null,
): boolean {
  const current = getEyewitnessMatch(roomId);
  if (!current || current.round.phase !== 'round-results') return false;
  const expanded = absorbSpectatorsAndExpandMatch(io, roomId, current);
  const participants = expanded.match.playerIds.map((playerId) => ({
    playerId,
    name: expanded.match.playerNames[playerId] ?? 'لاعب',
  }));
  const result = advanceEyewitnessRound(
    expanded.match,
    participants,
    requestId,
    Date.now(),
    Math.random,
    expanded.absorbedPlayerIds,
  );
  if (!result.ok || !result.changed) return false;
  setEyewitnessMatch(roomId, result.match);
  broadcast(io, roomId);
  restartEyewitnessTimer(io, roomId);
  return true;
}

export function restartEyewitnessTimer(io: Server, roomId: string): void {
  stopEyewitnessTimer(roomId);
  const match = getEyewitnessMatch(roomId);
  if (!match?.round.deadlineAtMs) return;
  const generation = (generationsByRoomId.get(roomId) ?? 0) + 1;
  generationsByRoomId.set(roomId, generation);
  const expectedRoundId = match.round.roundId;
  const expectedPhase = match.round.phase;
  const delay = Math.max(0, match.round.deadlineAtMs - Date.now());
  timersByRoomId.set(
    roomId,
    setTimeout(() => {
      if (generationsByRoomId.get(roomId) !== generation) return;
      timersByRoomId.delete(roomId);
      const current = getEyewitnessMatch(roomId);
      if (
        !current ||
        current.round.roundId !== expectedRoundId ||
        current.round.phase !== expectedPhase
      )
        return;
      if (expectedPhase === 'completed') {
        completeEyewitnessMatchLifecycle(io, roomId);
        return;
      }
      if (expectedPhase === 'round-results') {
        advanceEyewitnessAtBoundary(io, roomId, null);
        return;
      }
      const expired = expireEyewitnessPhase(current, expectedRoundId, expectedPhase);
      if (expired) {
        setEyewitnessMatch(roomId, expired);
        broadcast(io, roomId);
      }
      restartEyewitnessTimer(io, roomId);
    }, delay),
  );
}

export function settleEyewitnessDeadline(io: Server, roomId: string, now = Date.now()): boolean {
  const match = getEyewitnessMatch(roomId);
  if (!match || match.round.phase === 'completed' || match.round.phase === 'round-results')
    return false;
  const expired = expireEyewitnessPhase(match, match.round.roundId, match.round.phase, now);
  if (!expired) return false;
  setEyewitnessMatch(roomId, expired);
  broadcast(io, roomId);
  restartEyewitnessTimer(io, roomId);
  return true;
}

export function reconcileEyewitnessConnectivity(io: Server, roomId: string): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getEyewitnessMatch(roomId);
  if (!shell || shell.gameId !== EYEWITNESS_GAME_ID || !match) return;
  const next = reconcileEyewitnessWitnessConnection(
    match,
    isWitnessConnected(roomId, match.round.witnessPlayerId),
  );
  if (next !== match) {
    setEyewitnessMatch(roomId, next);
    broadcast(io, roomId);
  }
  restartEyewitnessTimer(io, roomId);
}

export function onEyewitnessPermanentLeave(io: Server, roomId: string, playerId: string): void {
  const match = getEyewitnessMatch(roomId);
  if (!match) return;
  let next = handleEyewitnessPermanentLeave(match, playerId);
  if (next.round.phase === 'drawing') {
    const departed = new Set(next.departedPlayerIds);
    const allRemainingSubmitted = next.round.artistPlayerIds
      .filter((id) => !departed.has(id))
      .every((id) => next.round.artworksByPlayerId[id]?.submitted);
    if (allRemainingSubmitted) next = beginEyewitnessVoting(next);
  }
  if (next === match) return;
  setEyewitnessMatch(roomId, next);
  broadcast(io, roomId);
  restartEyewitnessTimer(io, roomId);
}
