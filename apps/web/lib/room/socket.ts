import { io, type Socket } from 'socket.io-client';

import { getServerUrl } from '@/lib/config/server-url';

let socket: Socket | null = null;

export function getRoomSocket(): Socket {
  if (!socket) {
    socket = io(getServerUrl(), {
      autoConnect: false,
    });
  }

  return socket;
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

export function disconnectRoomSocket(): void {
  if (!socket) {
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
