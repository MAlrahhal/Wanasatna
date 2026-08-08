import type { LobbyGame, LobbyPlayer } from '@/lib/lobby/types';
import { mockLobbyGames } from '@/lib/lobby/mock-games';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';

export const demoGame: LobbyGame = mockLobbyGames[0]!;

export const demoComingSoonGame: LobbyGame =
  mockLobbyGames.find((game) => getGameCatalogEntry(game.id).availability === 'coming-soon') ??
  mockLobbyGames[2]!;

export const demoPlayers: LobbyPlayer[] = [
  { id: 'host', name: 'سارة', isHost: true, isSpectator: false },
  { id: 'guest', name: 'أحمد', isHost: false, isSpectator: false },
  { id: 'spectator', name: 'ليان', isHost: false, isSpectator: true },
];

export const demoCatalogEntry = getGameCatalogEntry(demoGame.id);
