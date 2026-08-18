import { resolveEffectiveGameSettings } from '@wanasatna/shared';
import { getRoomGameSettings } from '../room/room-game-settings.store.js';

export function effectiveGameSettings(
  gameId: string,
  roomId: string,
): Record<string, number> {
  return resolveEffectiveGameSettings(gameId, getRoomGameSettings(roomId));
}
