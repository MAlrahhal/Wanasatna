import type { Server } from 'socket.io';
import { SAME_WAVELENGTH_GAME_ID, SAME_WAVELENGTH_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { completeSameWavelengthMatch } from './match-lifecycle.js';
import { expireSameWavelengthPhase, handleSameWavelengthPermanentLeave } from './state.js';
import { getSameWavelengthMatch, setSameWavelengthMatch } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const generationsByRoomId = new Map<string, number>();

function broadcast(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(SAME_WAVELENGTH_PHASE_CHANGED_EVENT, {});
}

export function stopSameWavelengthTimer(roomId: string): void {
  const timer = timersByRoomId.get(roomId);
  if (timer) clearTimeout(timer);
  timersByRoomId.delete(roomId);
}

export function clearSameWavelengthTimerRuntime(roomId: string): void {
  stopSameWavelengthTimer(roomId);
  generationsByRoomId.delete(roomId);
}

export function restartSameWavelengthTimer(io: Server, roomId: string): void {
  stopSameWavelengthTimer(roomId);
  const match = getSameWavelengthMatch(roomId);
  if (!match?.turn.deadlineAtMs) return;
  const generation = (generationsByRoomId.get(roomId) ?? 0) + 1;
  generationsByRoomId.set(roomId, generation);
  const expectedTurnId = match.turn.turnId;
  const expectedPhase = match.turn.phase;
  const delay = Math.max(0, match.turn.deadlineAtMs - Date.now());
  timersByRoomId.set(
    roomId,
    setTimeout(() => {
      if (generationsByRoomId.get(roomId) !== generation) return;
      timersByRoomId.delete(roomId);
      const current = getSameWavelengthMatch(roomId);
      if (
        !current ||
        current.turn.turnId !== expectedTurnId ||
        current.turn.phase !== expectedPhase
      ) {
        return;
      }
      if (expectedPhase === 'completed') {
        completeSameWavelengthMatch(io, roomId);
        return;
      }
      const expired = expireSameWavelengthPhase(current, expectedTurnId, expectedPhase);
      if (expired) {
        setSameWavelengthMatch(roomId, expired);
        broadcast(io, roomId);
      }
      restartSameWavelengthTimer(io, roomId);
    }, delay),
  );
}

export function settleSameWavelengthDeadline(
  io: Server,
  roomId: string,
  now = Date.now(),
): boolean {
  const match = getSameWavelengthMatch(roomId);
  if (!match || match.turn.phase === 'completed') return false;
  const expired = expireSameWavelengthPhase(match, match.turn.turnId, match.turn.phase, now);
  if (!expired) return false;
  setSameWavelengthMatch(roomId, expired);
  broadcast(io, roomId);
  restartSameWavelengthTimer(io, roomId);
  return true;
}

export function reconcileSameWavelengthConnectivity(io: Server, roomId: string): void {
  const shell = getGameShellByRoomId(roomId);
  if (!shell || shell.gameId !== SAME_WAVELENGTH_GAME_ID || !getSameWavelengthMatch(roomId)) return;
  restartSameWavelengthTimer(io, roomId);
}

export function onSameWavelengthPermanentLeave(io: Server, roomId: string, playerId: string): void {
  const match = getSameWavelengthMatch(roomId);
  if (!match) return;
  const next = handleSameWavelengthPermanentLeave(match, playerId);
  if (next === match) return;
  setSameWavelengthMatch(roomId, next);
  broadcast(io, roomId);
  restartSameWavelengthTimer(io, roomId);
}
