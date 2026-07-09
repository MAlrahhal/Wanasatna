import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getRoomSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:4000', {
      autoConnect: false,
    });
  }

  return socket;
}

export function disconnectRoomSocket(): void {
  if (!socket) {
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
