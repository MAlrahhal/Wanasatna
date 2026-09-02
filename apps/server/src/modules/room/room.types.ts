declare module 'socket.io' {
  interface SocketData {
    playerId?: string;
    roomId?: string;
    adminSpectate?: boolean;
    adminSpectateRoomId?: string;
    authUser?: import('@wanasatna/shared').PublicUser | null;
  }
}

export {};
