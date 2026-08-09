import { io, type Socket } from 'socket.io-client';

import { getServerUrl } from '@/lib/config/server-url';

let socket: Socket | null = null;
let resumeHookInstalled = false;

function onManagerReconnect(): void {
  // Lazy import avoids a circular dependency with socket-resume.ts.
  void import('@/lib/room/socket-resume').then(({ rebindRoomSocketFromStoredSession }) => {
    void rebindRoomSocketFromStoredSession();
  });
}

function installResumeHook(activeSocket: Socket): void {
  if (resumeHookInstalled) {
    return;
  }

  activeSocket.io.on('reconnect', onManagerReconnect);
  resumeHookInstalled = true;
}

export function getRoomSocket(): Socket {
  if (!socket) {
    socket = io(getServerUrl(), {
      autoConnect: false,
    });
    installResumeHook(socket);
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

  socket.io.off('reconnect', onManagerReconnect);
  resumeHookInstalled = false;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
