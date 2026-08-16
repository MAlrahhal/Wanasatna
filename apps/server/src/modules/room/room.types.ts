declare module 'socket.io' {
  interface SocketData {
    playerId?: string;
    roomId?: string;
    authUser?: import('@wanasatna/shared').PublicUser | null;
  }
}

export {};
