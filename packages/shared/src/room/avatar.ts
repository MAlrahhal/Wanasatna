export const PLAYER_AVATAR_IDS = [
  'avatar-01',
  'avatar-02',
  'avatar-03',
  'avatar-04',
  'avatar-05',
  'avatar-06',
  'avatar-07',
  'avatar-08',
  'avatar-09',
  'avatar-10',
  'avatar-11',
  'avatar-12',
  'avatar-13',
  'avatar-14',
  'avatar-15',
  'avatar-16',
  'avatar-17',
  'avatar-18',
  'avatar-19',
  'avatar-20',
  'avatar-21',
  'avatar-22',
  'avatar-23',
  'avatar-24',
] as const;

export type PlayerAvatarId = (typeof PLAYER_AVATAR_IDS)[number];

const PLAYER_AVATAR_ID_SET = new Set<string>(PLAYER_AVATAR_IDS);

export function isPlayerAvatarId(value: unknown): value is PlayerAvatarId {
  return typeof value === 'string' && PLAYER_AVATAR_ID_SET.has(value);
}

export function getDefaultPlayerAvatarId(playerId: string): PlayerAvatarId {
  let hash = 2166136261;

  for (let index = 0; index < playerId.length; index += 1) {
    hash ^= playerId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return PLAYER_AVATAR_IDS[(hash >>> 0) % PLAYER_AVATAR_IDS.length]!;
}
