declare module 'socket.io' {
  interface SocketData {
    playerId?: string;
    roomId?: string;
  }
}

export {};
