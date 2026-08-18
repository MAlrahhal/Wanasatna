/** Default public / Guest / USER room capacity. */
export const MAX_ROOM_PLAYERS = 8;

/** Capacity for Rooms created while a valid ADMIN AuthSession is present. */
export const ADMIN_ROOM_PLAYER_CAP = 20;

/** Max characters for one room chat message after trim. */
export const MAX_ROOM_CHAT_CONTENT_LENGTH = 300;

/** Latest messages returned on chat sync. Oldest → newest in the payload. */
export const ROOM_CHAT_HISTORY_LIMIT = 50;
