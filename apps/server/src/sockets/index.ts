import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env.js';
import { consumeConnectLimit, startAbuseLimiterCleanup } from '../lib/abuse-limiter.js';
import { SOCKET_MAX_HTTP_BUFFER_SIZE } from '../lib/socket-limits.js';
import { attachOptionalSocketAuth } from '../modules/auth/socket-auth.js';
import { startExpiredAuthSessionCleanup } from '../modules/auth/auth-session-cleanup.js';
import { registerGameSockets } from '../modules/game/game.socket.js';
import { registerRoomSockets } from '../modules/room/room.socket.js';
import { startDisconnectedPlayerExpirySweep } from '../modules/room/services/disconnected-player-expiry.service.js';

/**
 * Creates the Socket.IO server and attaches it to the HTTP server.
 */
export { SOCKET_MAX_HTTP_BUFFER_SIZE } from '../lib/socket-limits.js';

export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin:
        env.nodeEnv === 'development'
          ? [env.clientOrigin, /^http:\/\/localhost:\d+$/]
          : env.clientOrigin,
      credentials: true,
    },
    maxHttpBufferSize: SOCKET_MAX_HTTP_BUFFER_SIZE,
  });

  io.use((socket, next) => {
    if (!consumeConnectLimit(socket)) {
      next(new Error('RATE_LIMITED'));
      return;
    }

    void attachOptionalSocketAuth(socket)
      .catch(() => {
        socket.data.authUser = null;
      })
      .finally(() => {
        next();
      });
  });

  registerRoomSockets(io);
  registerGameSockets(io);
  startDisconnectedPlayerExpirySweep(io);
  startExpiredAuthSessionCleanup();
  startAbuseLimiterCleanup();

  return io;
}
