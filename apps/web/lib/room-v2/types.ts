/**
 * Client Room Core V2 — ephemeral RoomPlayer participation only.
 * Not account identity. Field names match the server contract.
 */

export type ActiveRoomSession = {
  roomId: string;
  roomCode: string;
  playerId: string;
  /** Server `player.name` — display name for this RoomPlayer. */
  playerName: string;
  /** Opaque resume credential from Create/Join/Reconnect ACK. */
  reconnectToken: string;
};

export type RoomLifecycleStatus =
  | 'idle'
  | 'entering'
  | 'active'
  | 'recovering'
  | 'leaving'
  | 'error';

export type RoomV2Result<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export const ACTIVE_ROOM_SESSION_KEY = 'wanasatna:active-room-session' as const;
