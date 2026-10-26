import {
  EMOJI_LANGUAGE_GAME_ID,
  EYEWITNESS_GAME_ID,
  MOST_LIKELY_TO_GAME_ID,
  SECRET_AGENTS_GAME_ID,
  TIMELINE_PLACEMENT_GAME_ID,
  ONE_WORD_ONLY_GAME_ID,
} from '@wanasatna/shared';
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
  [EMOJI_LANGUAGE_GAME_ID]: {
    id: EMOJI_LANGUAGE_GAME_ID,
    title: 'لغة الإيموجي',
    description: 'حوّل المعنى إلى رموز وافهم تلميحات الآخرين',
    iconLabel: '😀',
    emoji: '😀',
  },
  [TIMELINE_PLACEMENT_GAME_ID]: {
    id: TIMELINE_PLACEMENT_GAME_ID,
    title: 'زمانها وين؟',
    description: 'ضع الحدث في مكانه الصحيح على الخط الزمني',
    iconLabel: 'ز',
    emoji: '🕰️',
  },
  [ONE_WORD_ONLY_GAME_ID]: {
    id: ONE_WORD_ONLY_GAME_ID,
    title: 'كلمة وحدة بس',
    description: 'تلميحات فردية تقود المخمّن إلى اختيار واحد من ثمانية',
    iconLabel: 'ك',
    emoji: '💡',
  },
  [EYEWITNESS_GAME_ID]: {
    id: EYEWITNESS_GAME_ID,
    title: 'شاهد عيان',
    description: 'صف الصورة ليرسمها اللاعبون ثم اختاروا أفضل رسمة',
    iconLabel: 'ع',
    emoji: '👁️',
  },
};

/** Safe display metadata only; authority remains room.experimentalGameId from the server. */
export function getExperimentalRoomGame(gameId: string | null | undefined): LobbyGame | null {
  return gameId ? (experimentalRoomGames[gameId] ?? null) : null;
}
