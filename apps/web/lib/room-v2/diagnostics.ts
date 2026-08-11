type RoomV2DiagEvent =
  | 'SESSION_SET'
  | 'SESSION_CLEAR'
  | 'CREATE_START'
  | 'CREATE_SUCCESS'
  | 'JOIN_START'
  | 'JOIN_SUCCESS'
  | 'RESUME_START'
  | 'RESUME_SUCCESS'
  | 'LEAVE'
  | 'SOCKET_DISCONNECTED'
  | 'SOCKET_RECONNECTED'
  | 'FOREIGN_SNAPSHOT_DROPPED'
  | 'STALE_OPERATION_DROPPED';

const ENABLED =
  typeof process !== 'undefined' &&
  (process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_ROOM_V2_DIAG === '1' ||
    process.env.NEXT_PUBLIC_ROOM_V2_DIAG === 'true');

export function roomV2Diag(
  event: RoomV2DiagEvent,
  data: {
    roomCode?: string | null;
    roomId?: string | null;
    playerId?: string | null;
    generation?: number;
    [key: string]: unknown;
  } = {},
): void {
  if (!ENABLED) {
    return;
  }

  // Never log reconnectToken / secrets.
  const { reconnectToken: _omit, ...safe } = data as Record<string, unknown>;
  void _omit;
  console.info('[room-v2]', JSON.stringify({ ts: Date.now(), event, ...safe }));
}
