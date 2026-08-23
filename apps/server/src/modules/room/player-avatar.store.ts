import { getDefaultPlayerAvatarId, type PlayerAvatarId } from '@wanasatna/shared';

type PlayerAvatarSelection = {
  roomId: string;
  avatarId: PlayerAvatarId;
};

const selectionsByPlayerId = new Map<string, PlayerAvatarSelection>();

export function getPlayerAvatarId(playerId: string): PlayerAvatarId {
  return selectionsByPlayerId.get(playerId)?.avatarId ?? getDefaultPlayerAvatarId(playerId);
}

export function setPlayerAvatarId(
  playerId: string,
  roomId: string,
  avatarId: PlayerAvatarId,
): void {
  selectionsByPlayerId.set(playerId, { roomId, avatarId });
}

export function clearPlayerAvatarId(playerId: string): void {
  selectionsByPlayerId.delete(playerId);
}

export function clearRoomPlayerAvatars(roomId: string): void {
  for (const [playerId, selection] of selectionsByPlayerId) {
    if (selection.roomId === roomId) {
      selectionsByPlayerId.delete(playerId);
    }
  }
}
