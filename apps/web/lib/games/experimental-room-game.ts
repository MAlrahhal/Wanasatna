import type { LobbyGame } from '@/lib/lobby/types';
import { getClientGamePlugin } from '@/lib/game-plugins/registry';

export function getExperimentalRoomLobbyGame(gameId: string | null | undefined): LobbyGame | null {
  if (!gameId) return null;
  const metadata = getClientGamePlugin(gameId)?.metadata;
  if (!metadata) return null;
  return {
    id: metadata.id,
    title: metadata.title,
    description: metadata.description,
    iconLabel: metadata.iconLabel,
    emoji: metadata.iconLabel,
  };
}
