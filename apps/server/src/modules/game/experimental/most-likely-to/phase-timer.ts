import type { Server } from 'socket.io';
import { MOST_LIKELY_TO_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getMostLikelyToMatch, setMostLikelyToMatch } from './store.js';
import { settleMostLikelyToDeadline } from './state.js';

type TimerRuntime = {
  questionId: string;
  timeoutId: ReturnType<typeof setTimeout>;
};

const timersByRoomId = new Map<string, TimerRuntime>();

export function clearMostLikelyToTimerRuntime(roomId: string): void {
  const runtime = timersByRoomId.get(roomId);
  if (runtime) clearTimeout(runtime.timeoutId);
  timersByRoomId.delete(roomId);
}

function broadcastChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(MOST_LIKELY_TO_PHASE_CHANGED_EVENT, {});
}

export function settleMostLikelyToRoomDeadline(
  io: Server,
  roomId: string,
  now = Date.now(),
): boolean {
  const match = getMostLikelyToMatch(roomId);
  if (!match) return false;
  const settled = settleMostLikelyToDeadline(match, now);
  if (settled === match) return false;
  clearMostLikelyToTimerRuntime(roomId);
  setMostLikelyToMatch(roomId, settled);
  broadcastChanged(io, roomId);
  return true;
}

export function restartMostLikelyToTimer(io: Server, roomId: string): void {
  clearMostLikelyToTimerRuntime(roomId);
  const match = getMostLikelyToMatch(roomId);
  if (!match || match.phase !== 'voting' || match.currentQuestion.deadlineAtMs === null) {
    return;
  }

  const questionId = match.currentQuestion.questionId;
  const delay = Math.max(0, match.currentQuestion.deadlineAtMs - Date.now());
  const timeoutId = setTimeout(() => {
    const latest = getMostLikelyToMatch(roomId);
    if (!latest || latest.currentQuestion.questionId !== questionId) return;
    settleMostLikelyToRoomDeadline(io, roomId);
  }, delay + 5);
  timersByRoomId.set(roomId, { questionId, timeoutId });
}
