'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';
import {
  MOST_LIKELY_TO_GAME_ID,
  MOST_LIKELY_TO_MAX_PLAYERS,
  MOST_LIKELY_TO_MIN_PLAYERS,
} from '@wanasatna/shared';

export const mostLikelyToClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: MOST_LIKELY_TO_GAME_ID,
    title: 'مين أكثر واحد؟',
    description: 'صوّتوا سرًا، ثم اكشفوا اختيارات المجموعة',
    iconLabel: '؟',
    minPlayers: MOST_LIKELY_TO_MIN_PLAYERS,
    maxPlayers: MOST_LIKELY_TO_MAX_PLAYERS,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((module) => module.MostLikelyToGameScreen),
  ),
};
