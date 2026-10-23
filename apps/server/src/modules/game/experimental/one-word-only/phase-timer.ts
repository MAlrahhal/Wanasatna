import type { Server } from 'socket.io';
import { ONE_WORD_ONLY_GAME_ID, ONE_WORD_ONLY_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { absorbSpectatorsAndExpandMatch } from '../../runtime/absorb-spectators-for-next-round.js';
import { completeOneWordOnlyMatch } from './match-lifecycle.js';
import {
  advanceOneWordOnlyRound,
  closeOneWordOnlyCluePhase,
  expireOneWordOnlyPhase,
  handleOneWordOnlyPermanentLeave,
  reconcileOneWordOnlyGuesserConnection,
} from './state.js';
import { getOneWordOnlyMatch, setOneWordOnlyMatch } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const generationsByRoomId = new Map<string, number>();

export function stopOneWordOnlyTimer(roomId: string): void {
  const timer = timersByRoomId.get(roomId);
  if (timer) clearTimeout(timer);
  timersByRoomId.delete(roomId);
}

export function clearOneWordOnlyTimerRuntime(roomId: string): void {
  stopOneWordOnlyTimer(roomId);
  generationsByRoomId.delete(roomId);
}

function broadcast(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(ONE_WORD_ONLY_PHASE_CHANGED_EVENT, {});
}

function isGuesserConnected(roomId: string, guesserPlayerId: string): boolean {
  return (
    getGameShellByRoomId(roomId)?.players.some(
      (player) => player.id === guesserPlayerId && player.isConnected,
    ) === true
  );
}

export function advanceOneWordOnlyAtBoundary(
  io: Server,
  roomId: string,
  requestId: string | null,
): boolean {
  const current = getOneWordOnlyMatch(roomId);
  if (!current || current.round.phase !== 'round-reveal') return false;
  const expanded = absorbSpectatorsAndExpandMatch(io, roomId, current);
  const participants = expanded.match.playerIds.map((playerId) => ({
    playerId,
    name: expanded.match.playerNames[playerId] ?? 'لاعب',
  }));
  const result = advanceOneWordOnlyRound(
    expanded.match,
    participants,
    requestId,
    Date.now(),
    Math.random,
    expanded.absorbedPlayerIds,
  );
  if (!result.ok || !result.changed) return false;
  setOneWordOnlyMatch(roomId, result.match);
  broadcast(io, roomId);
  restartOneWordOnlyTimer(io, roomId);
  return true;
}

export function restartOneWordOnlyTimer(io: Server, roomId: string): void {
  stopOneWordOnlyTimer(roomId);
  const match = getOneWordOnlyMatch(roomId);
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
      const current = getOneWordOnlyMatch(roomId);
      if (
        !current ||
        current.round.roundId !== expectedRoundId ||
        current.round.phase !== expectedPhase
      )
        return;
      if (expectedPhase === 'completed') {
        completeOneWordOnlyMatch(io, roomId);
        return;
      }
      if (expectedPhase === 'round-reveal') {
        advanceOneWordOnlyAtBoundary(io, roomId, null);
        return;
      }
      const expired = expireOneWordOnlyPhase(
        current,
        expectedRoundId,
        expectedPhase,
        isGuesserConnected(roomId, current.round.guesserPlayerId),
      );
      if (expired) {
        setOneWordOnlyMatch(roomId, expired);
        broadcast(io, roomId);
      }
      restartOneWordOnlyTimer(io, roomId);
    }, delay),
  );
}

export function settleOneWordOnlyDeadline(io: Server, roomId: string, now = Date.now()): boolean {
  const match = getOneWordOnlyMatch(roomId);
  if (!match || match.round.phase === 'completed' || match.round.phase === 'round-reveal')
    return false;
  const expired = expireOneWordOnlyPhase(
    match,
    match.round.roundId,
    match.round.phase,
    isGuesserConnected(roomId, match.round.guesserPlayerId),
    now,
  );
  if (!expired) return false;
  setOneWordOnlyMatch(roomId, expired);
  broadcast(io, roomId);
  restartOneWordOnlyTimer(io, roomId);
  return true;
}

export function reconcileOneWordOnlyConnectivity(io: Server, roomId: string): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getOneWordOnlyMatch(roomId);
  if (!shell || shell.gameId !== ONE_WORD_ONLY_GAME_ID || !match) return;
  const next = reconcileOneWordOnlyGuesserConnection(
    match,
    isGuesserConnected(roomId, match.round.guesserPlayerId),
  );
  if (next !== match) {
    setOneWordOnlyMatch(roomId, next);
    broadcast(io, roomId);
  }
  restartOneWordOnlyTimer(io, roomId);
}

export function onOneWordOnlyPermanentLeave(io: Server, roomId: string, playerId: string): void {
  const match = getOneWordOnlyMatch(roomId);
  if (!match) return;
  let next = handleOneWordOnlyPermanentLeave(match, playerId);
  if (next.round.phase === 'clue-writing') {
    const outstanding = next.round.eligibleWriterIds.some(
      (id) => !next.departedPlayerIds.includes(id) && !next.round.cluesByPlayerId[id],
    );
    if (!outstanding) {
      next = closeOneWordOnlyCluePhase(next, false);
      next = reconcileOneWordOnlyGuesserConnection(
        next,
        isGuesserConnected(roomId, next.round.guesserPlayerId),
      );
    }
  }
  if (next === match) return;
  setOneWordOnlyMatch(roomId, next);
  broadcast(io, roomId);
  restartOneWordOnlyTimer(io, roomId);
}
