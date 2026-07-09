import type { Server } from 'socket.io';
import {
  registerCreateRoomHandler,
  registerDisconnectHandler,
  registerJoinRoomHandler,
  registerKickPlayerHandler,
  registerLeaveRoomHandler,
  registerLockRoomHandler,
  registerReconnectHandler,
  registerUnlockRoomHandler,
} from './room.socket.handlers.js';

export function registerRoomSockets(io: Server): void {
  io.on('connection', (socket) => {
    registerCreateRoomHandler(socket);
    registerJoinRoomHandler(socket);
    registerLeaveRoomHandler(io, socket);
    registerKickPlayerHandler(io, socket);
    registerLockRoomHandler(io, socket);
    registerUnlockRoomHandler(io, socket);
    registerReconnectHandler(io, socket);
    registerDisconnectHandler(socket);
  });
}
