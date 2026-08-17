import type { Server } from 'socket.io';
import './room.types.js';
import {
  registerCreateRoomHandler,
  registerDisconnectHandler,
  registerJoinRoomHandler,
  registerKickPlayerHandler,
  registerLeaveRoomHandler,
  registerLockRoomHandler,
  registerReconnectHandler,
  registerRoomSyncHandler,
  registerUnlockRoomHandler,
} from './room.socket.handlers.js';
import { registerRoomChatHandlers } from './room-chat.socket.handlers.js';

export function registerRoomSockets(io: Server): void {
  io.on('connection', (socket) => {
    registerCreateRoomHandler(io, socket);
    registerJoinRoomHandler(io, socket);
    registerLeaveRoomHandler(io, socket);
    registerKickPlayerHandler(io, socket);
    registerLockRoomHandler(io, socket);
    registerUnlockRoomHandler(io, socket);
    registerReconnectHandler(io, socket);
    registerRoomSyncHandler(io, socket);
    registerRoomChatHandlers(io, socket);
    registerDisconnectHandler(io, socket);
  });
}
