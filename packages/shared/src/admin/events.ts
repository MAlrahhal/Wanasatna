export const ADMIN_SPECTATE_JOIN_EVENT = 'admin-spectate-join' as const;
export const ADMIN_SPECTATE_LEAVE_EVENT = 'admin-spectate-leave' as const;
export const ADMIN_SPECTATE_SYNC_EVENT = 'admin-spectate-sync' as const;

export const ADMIN_SPECTATE_ALLOWED_EVENTS = [
  ADMIN_SPECTATE_JOIN_EVENT,
  ADMIN_SPECTATE_LEAVE_EVENT,
  ADMIN_SPECTATE_SYNC_EVENT,
] as const;

export type AdminSpectateAllowedEvent = (typeof ADMIN_SPECTATE_ALLOWED_EVENTS)[number];
