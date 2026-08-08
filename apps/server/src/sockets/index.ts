import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env.js';
import { registerGameSockets } from '../modules/game/game.socket.js';
import { registerRoomSockets } from '../modules/room/room.socket.js';

/**
 * Creates the Socket.IO server and attaches it to the HTTP server.
 */
export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin:
        env.nodeEnv === 'development'
          ? [env.clientOrigin, /^http:\/\/localhost:\d+$/]
          : env.clientOrigin,
    },
  });

  registerRoomSockets(io);
  registerGameSockets(io);

  return io;
}
