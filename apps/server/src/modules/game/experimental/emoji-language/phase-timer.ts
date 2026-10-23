import type { Server } from 'socket.io';
import { EMOJI_LANGUAGE_GAME_ID, EMOJI_LANGUAGE_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { completeEmojiLanguageMatch } from './match-lifecycle.js';
import { expireEmojiLanguagePhase, handleEmojiLanguagePermanentLeave } from './state.js';
import { getEmojiLanguageMatch, setEmojiLanguageMatch } from './store.js';

const timersByRoomId = new Map<string, ReturnType<typeof setTimeout>>();
const generationsByRoomId = new Map<string, number>();

export function stopEmojiLanguageTimer(roomId: string): void {
  const timer = timersByRoomId.get(roomId);
  if (timer) clearTimeout(timer);
  timersByRoomId.delete(roomId);
}

export function clearEmojiLanguageTimerRuntime(roomId: string): void {
  stopEmojiLanguageTimer(roomId);
  generationsByRoomId.delete(roomId);
}

function broadcast(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(EMOJI_LANGUAGE_PHASE_CHANGED_EVENT, {});
}

export function restartEmojiLanguageTimer(io: Server, roomId: string): void {
  stopEmojiLanguageTimer(roomId);
  const match = getEmojiLanguageMatch(roomId);
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
      const current = getEmojiLanguageMatch(roomId);
      if (
        !current ||
        current.round.roundId !== expectedRoundId ||
        current.round.phase !== expectedPhase
      ) {
        return;
      }
      if (current.round.phase === 'completed') {
        completeEmojiLanguageMatch(io, roomId);
        return;
      }
      const expired = expireEmojiLanguagePhase(current, expectedRoundId, expectedPhase);
      if (expired) {
        setEmojiLanguageMatch(roomId, expired);
        broadcast(io, roomId);
      }
      restartEmojiLanguageTimer(io, roomId);
    }, delay),
  );
}

export function settleEmojiLanguageDeadline(io: Server, roomId: string, now = Date.now()): boolean {
  const match = getEmojiLanguageMatch(roomId);
  if (!match || match.round.phase === 'completed') return false;
  const expired = expireEmojiLanguagePhase(match, match.round.roundId, match.round.phase, now);
  if (!expired) return false;
  setEmojiLanguageMatch(roomId, expired);
  broadcast(io, roomId);
  restartEmojiLanguageTimer(io, roomId);
  return true;
}

/** Disconnects never pause or extend the authoritative phase deadline. */
export function reconcileEmojiLanguageConnectivity(io: Server, roomId: string): void {
  const shell = getGameShellByRoomId(roomId);
  if (!shell || shell.gameId !== EMOJI_LANGUAGE_GAME_ID || !getEmojiLanguageMatch(roomId)) return;
  restartEmojiLanguageTimer(io, roomId);
}

export function onEmojiLanguagePermanentLeave(io: Server, roomId: string, playerId: string): void {
  const match = getEmojiLanguageMatch(roomId);
  if (!match) return;
  const next = handleEmojiLanguagePermanentLeave(match, playerId);
  if (next === match) return;
  setEmojiLanguageMatch(roomId, next);
  broadcast(io, roomId);
  restartEmojiLanguageTimer(io, roomId);
}
