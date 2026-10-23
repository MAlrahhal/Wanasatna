import { MOST_LIKELY_TO_GAME_ID, SECRET_AGENTS_GAME_ID } from '@wanasatna/shared';
import type { LobbyGame } from '@/lib/lobby/types';

const experimentalRoomGames: Record<string, LobbyGame> = {
  [SECRET_AGENTS_GAME_ID]: {
    id: SECRET_AGENTS_GAME_ID,
    title: 'العملاء السريون',
    description: 'لعبة فرق مغلقة الاختبار',
    iconLabel: 'س',
    emoji: '🕵️',
  },
  [MOST_LIKELY_TO_GAME_ID]: {
    id: MOST_LIKELY_TO_GAME_ID,
    title: 'مين أكثر واحد؟',
    description: 'تصويت اجتماعي سري لعشرة مواقف مرحة',
    iconLabel: '؟',
    emoji: '👑',
  },
};

/** Safe display metadata only; authority remains room.experimentalGameId from the server. */
export function getExperimentalRoomGame(gameId: string | null | undefined): LobbyGame | null {
  return gameId ? (experimentalRoomGames[gameId] ?? null) : null;
}
