'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';
import {
  ONE_WORD_ONLY_GAME_ID,
  ONE_WORD_ONLY_MAX_PLAYERS,
  ONE_WORD_ONLY_MIN_PLAYERS,
} from '@wanasatna/shared';

export const oneWordOnlyClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: ONE_WORD_ONLY_GAME_ID,
    title: 'كلمة وحدة بس',
    description: 'تلميح واحد من كل لاعب، ثم اختيار تعاوني من ثمانية خيارات.',
    iconLabel: 'ك',
    minPlayers: ONE_WORD_ONLY_MIN_PLAYERS,
    maxPlayers: ONE_WORD_ONLY_MAX_PLAYERS,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((module) => module.OneWordOnlyGameScreen),
  ),
};
