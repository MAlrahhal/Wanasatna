import { PLAYER_AVATAR_IDS, type PlayerAvatarId } from '@wanasatna/shared';

export const playerAvatarCatalog = PLAYER_AVATAR_IDS.map((id) => ({
  id,
  src: `/avatars/${id}.png`,
}));

export function getPlayerAvatarSrc(avatarId: PlayerAvatarId): string {
  return `/avatars/${avatarId}.png`;
}
