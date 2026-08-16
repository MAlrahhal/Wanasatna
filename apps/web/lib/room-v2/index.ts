export type {
  ActiveRoomSession,
  RoomLifecycleStatus,
  RoomV2Result,
} from '@/lib/room-v2/types';
export { ACTIVE_ROOM_SESSION_KEY } from '@/lib/room-v2/types';
export {
  clearPersistedActiveRoomSession,
  purgeLegacyRoomStorage,
  readPersistedActiveRoomSession,
  writePersistedActiveRoomSession,
} from '@/lib/room-v2/storage';
export {
  getRoomSessionManager,
  __resetRoomSessionManagerForTests,
  type RoomManagerState,
  type RoomRuntimeSnapshot,
} from '@/lib/room-v2/manager';
export {
  RECONNECT_CLAIMS_STORAGE_KEY,
  readReconnectClaim,
  removeReconnectClaim,
  removeReconnectClaimForSession,
  writeReconnectClaim,
} from '@/lib/room-v2/reconnect-claims';
export {
  canAutoResumeWithExplicitName,
  isTerminalResumeFailure,
  resolveExplicitJoinIntent,
  selectExplicitJoinReconnectIdentity,
} from '@/lib/room-v2/join-intent';
export {
  getContinuityLog,
  getReconnectEmitCount,
  getRuntimeId,
  recordContinuity,
  resetReconnectEmitCount,
} from '@/lib/room-v2/continuity';
