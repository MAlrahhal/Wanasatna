import type { Server, Socket } from 'socket.io';
import {
  MARATHON_CONTINUE_EVENT,
  MARATHON_PREPARE_EVENT,
  MARATHON_RETURN_TO_LOBBY_EVENT,
  MARATHON_START_EVENT,
  MARATHON_STATE_EVENT,
  MARATHON_SYNC_EVENT,
  type ContinueMarathonPayload,
  type StartMarathonPayload,
} from '@wanasatna/shared';
import {
  getGameSocketContext,
  sendGameInternalError,
  sendGameResponse,
} from '../game/game.socket.utils.js';
import { getRoomChannel } from '../room/room.utils.js';
import { getMarathonState } from './marathon.store.js';
import { continueMarathon, prepareMarathon, startMarathon } from './marathon.runtime.js';
import { validateMarathonPlan } from './marathon.validation.js';

function validationError(message: string) {
  return { success: false as const, error: { code: 'VALIDATION_ERROR' as const, message } };
}

export function registerMarathonSocketHandlers(io: Server, socket: Socket): void {
  socket.on(MARATHON_PREPARE_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }
    try {
      const state = await prepareMarathon(socket.data.roomId!, socket.data.playerId!);
      if (!state) {
        sendGameResponse(callback, validationError('المضيف فقط يمكنه تجهيز الماراتون.'));
        return;
      }
      io.to(getRoomChannel(state.roomId)).emit(MARATHON_STATE_EVENT, { state });
      io.to(getRoomChannel(state.roomId)).emit('game-shell-navigate', {
        path: '/marathon',
        roomId: state.roomId,
      });
      sendGameResponse(callback, { success: true, data: { state } });
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(MARATHON_SYNC_EVENT, (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }
    const state = getMarathonState(socket.data.roomId!);
    if (state) {
      socket.emit(MARATHON_STATE_EVENT, { state });
    }
    sendGameResponse(callback, { success: true, data: { state } });
  });

  socket.on(MARATHON_START_EVENT, async (payload: StartMarathonPayload, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }
    const validation = validateMarathonPlan(payload?.gamePlan);
    if (!validation.success) {
      sendGameResponse(callback, validationError(validation.message));
      return;
    }
    try {
      const result = await startMarathon(
        io,
        socket.data.roomId!,
        socket.data.playerId!,
        validation.plan,
      );
      sendGameResponse(
        callback,
        result.success
          ? { success: true, data: { state: result.state } }
          : validationError(result.message),
      );
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(MARATHON_CONTINUE_EVENT, async (payload: ContinueMarathonPayload, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }
    try {
      const state = await continueMarathon(io, socket.data.roomId!, socket.data.playerId!, payload);
      sendGameResponse(
        callback,
        state
          ? { success: true, data: { state } }
          : validationError('انتهت صلاحية هذا الإجراء أو أنك لست المضيف الحالي.'),
      );
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(MARATHON_RETURN_TO_LOBBY_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }
    const state = getMarathonState(socket.data.roomId!);
    if (!state || state.status !== 'FINISHED') {
      sendGameResponse(callback, validationError('نتائج الماراتون النهائية غير جاهزة.'));
      return;
    }
    try {
      const continued = await continueMarathon(io, socket.data.roomId!, socket.data.playerId!, {
        marathonId: state.marathonId,
        currentGameIndex: state.currentGameIndex,
        activeShellId: state.activeShellId,
      });
      sendGameResponse(
        callback,
        continued
          ? { success: true, data: { path: '/lobby' as const } }
          : validationError('المضيف الحالي فقط يمكنه إنهاء الماراتون.'),
      );
    } catch {
      sendGameInternalError(callback);
    }
  });
}
