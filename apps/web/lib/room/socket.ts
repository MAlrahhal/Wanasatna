import { io, type Socket } from 'socket.io-client';

import { getServerUrl } from '@/lib/config/server-url';

const SOCKET_GLOBAL_KEY = '__wanasatna_room_socket_v2__';

type SocketGlobal = typeof globalThis & {
  [SOCKET_GLOBAL_KEY]?: Socket | null;
};

/**
 * Socket.IO singleton on globalThis so App Router client bundles share one instance.
 * Room identity is owned by RoomSessionManager (V2), not by this module.
 */
export function getRoomSocket(): Socket {
  const g = globalThis as SocketGlobal;
  if (!g[SOCKET_GLOBAL_KEY]) {
    g[SOCKET_GLOBAL_KEY] = io(getServerUrl(), {
      autoConnect: false,
      // True transport drops while in-room should recover; Leave disables this first.
      reconnection: true,
    });
  }

  return g[SOCKET_GLOBAL_KEY]!;
}

export function waitForRoomSocketConnection(activeSocket: Socket, timeoutMs = 10000): Promise<void> {
  if (activeSocket.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('SOCKET_CONNECT_TIMEOUT'));
    }, timeoutMs);

    const onConnect = () => {
      cleanup();
      resolve();
    };

    const onConnectError = () => {
      cleanup();
      reject(new Error('SOCKET_CONNECT_FAILED'));
    };

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      activeSocket.off('connect', onConnect);
      activeSocket.off('connect_error', onConnectError);
    };

    activeSocket.once('connect', onConnect);
    activeSocket.once('connect_error', onConnectError);
  });
}

/**
 * Tear down the singleton for Explicit Leave.
 * Must disable Manager auto-reconnect — otherwise a zombie reconnect after Leave
 * races the next Create/Join and can bounce Lobby back Home.
 */
export function disconnectRoomSocket(): void {
  const g = globalThis as SocketGlobal;
  const active = g[SOCKET_GLOBAL_KEY];
  if (!active) {
    return;
  }

  try {
    active.io.reconnection(false);
  } catch {
    /* ignore */
  }

  active.removeAllListeners();
  active.disconnect();
  g[SOCKET_GLOBAL_KEY] = null;
}
