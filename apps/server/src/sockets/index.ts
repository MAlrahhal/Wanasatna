import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env.js';
import { registerRoomSockets } from '../modules/room/room.socket.js';

/**
 * Creates the Socket.IO server and attaches it to the HTTP server.
 */
export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.clientOrigin,
    },
  });

  registerRoomSockets(io);

  return io;
}
