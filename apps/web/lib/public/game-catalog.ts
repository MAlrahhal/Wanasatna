import { mockLobbyGames } from '@/lib/lobby/mock-games';
import type { LobbyGame } from '@/lib/lobby/types';

export type GameAvailability = 'available' | 'coming-soon';

export type GameCatalogEntry = {
  availability: GameAvailability;
  accent: string;
  accentLight: string;
  accentBorder: string;
  iconBg: string;
  iconText: string;
  shadow: string;
  playerRange: string;
  featured: boolean;
};

export const gameCatalogById: Record<string, GameCatalogEntry> = {
  'bara-al-salafa': {
    availability: 'available',
    accent: 'var(--wanas-game-blue)',
    accentLight: 'var(--wanas-game-blue-surface)',
    accentBorder: 'var(--wanas-game-blue-border)',
    iconBg: 'var(--wanas-game-blue-icon-bg)',
    iconText: 'var(--wanas-game-blue-icon-text)',
    shadow: 'shadow-wanas-game-blue/15',
    playerRange: '٣–١٢ لاعب',
    featured: true,
  },
  'draw-guess': {
    availability: 'available',
    accent: 'var(--wanas-game-orange)',
    accentLight: 'var(--wanas-game-orange-surface)',
    accentBorder: 'var(--wanas-game-orange-border)',
    iconBg: 'var(--wanas-game-orange-icon-bg)',
    iconText: 'var(--wanas-game-orange-icon-text)',
    shadow: 'shadow-wanas-game-orange/15',
    playerRange: '٢–١٢ لاعب',
    featured: true,
  },
  'timing-challenge': {
    availability: 'available',
    accent: 'var(--wanas-game-rose)',
    accentLight: 'var(--wanas-game-rose-surface)',
    accentBorder: 'var(--wanas-game-rose-border)',
    iconBg: 'var(--wanas-game-rose-icon-bg)',
    iconText: 'var(--wanas-game-rose-icon-text)',
    shadow: 'shadow-wanas-game-rose/15',
    playerRange: '٢–١٢ لاعب',
    featured: true,
  },
  'fast-answer': {
    availability: 'available',
    accent: 'var(--wanas-game-teal)',
    accentLight: 'var(--wanas-game-teal-surface)',
    accentBorder: 'var(--wanas-game-teal-border)',
    iconBg: 'var(--wanas-game-teal-icon-bg)',
    iconText: 'var(--wanas-game-teal-icon-text)',
    shadow: 'shadow-wanas-game-teal/15',
    playerRange: '٢–١٢ لاعب',
    featured: true,
  },
  'imposter-draw': {
    availability: 'available',
    accent: 'var(--wanas-game-purple)',
    accentLight: 'var(--wanas-game-purple-surface)',
    accentBorder: 'var(--wanas-game-purple-border-strong)',
    iconBg: 'var(--wanas-game-purple-icon-bg)',
    iconText: 'var(--wanas-game-purple-icon-text)',
    shadow: 'shadow-wanas-game-purple/10',
    playerRange: '٣–١٢ لاعب',
    featured: true,
  },
  'who-wrote-it': {
    availability: 'available',
    accent: 'var(--wanas-game-purple)',
    accentLight: 'var(--wanas-game-purple-surface)',
    accentBorder: 'var(--wanas-game-purple-border-strong)',
    iconBg: 'var(--wanas-game-purple-icon-bg)',
    iconText: 'var(--wanas-game-purple-icon-text)',
    shadow: 'shadow-wanas-game-purple/10',
    playerRange: '٣–١٢ لاعب',
    featured: false,
  },
  judge: {
    availability: 'coming-soon',
    accent: 'var(--wanas-text-muted)',
    accentLight: 'var(--wanas-game-slate-surface)',
    accentBorder: 'var(--wanas-game-slate-border)',
    iconBg: 'var(--wanas-game-slate-icon-bg)',
    iconText: 'var(--wanas-game-slate-icon-text-dark)',
    shadow: 'shadow-wanas-game-slate/40',
    playerRange: '٣–١٢ لاعب',
    featured: false,
  },
  marathon: {
    availability: 'coming-soon',
    accent: 'var(--wanas-game-green)',
    accentLight: 'var(--wanas-game-green-surface)',
    accentBorder: 'var(--wanas-game-green-border)',
    iconBg: 'var(--wanas-game-green-icon-bg)',
    iconText: 'var(--wanas-game-green-icon-text)',
    shadow: 'shadow-wanas-game-green/10',
    playerRange: '٤–١٢ لاعب',
    featured: false,
  },
};

const defaultCatalogEntry: GameCatalogEntry = {
  availability: 'coming-soon',
  accent: 'var(--wanas-game-slate)',
  accentLight: 'var(--wanas-game-slate-surface)',
  accentBorder: 'var(--wanas-game-slate-border)',
  iconBg: 'var(--wanas-game-slate-icon-bg)',
  iconText: 'var(--wanas-game-slate-icon-text)',
  shadow: 'shadow-wanas-game-slate/40',
  playerRange: '٢–١٢ لاعب',
  featured: false,
};

export function getGameCatalogEntry(gameId: string): GameCatalogEntry {
  return gameCatalogById[gameId] ?? defaultCatalogEntry;
}

export function getAllCatalogGames(): LobbyGame[] {
  return mockLobbyGames;
}

export function getFeaturedGames(): LobbyGame[] {
  return mockLobbyGames.filter((game) => getGameCatalogEntry(game.id).featured);
}

export function filterCatalogGames(
  games: LobbyGame[],
  filter: 'all' | 'available' | 'coming-soon',
): LobbyGame[] {
  if (filter === 'all') {
    return games;
  }

  return games.filter((game) => {
    const entry = getGameCatalogEntry(game.id);
    return filter === 'available'
      ? entry.availability === 'available'
      : entry.availability === 'coming-soon';
  });
}
