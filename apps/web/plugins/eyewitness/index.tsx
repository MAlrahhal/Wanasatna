'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';
import {
  EYEWITNESS_GAME_ID,
  EYEWITNESS_MAX_PLAYERS,
  EYEWITNESS_MIN_PLAYERS,
} from '@wanasatna/shared';

export const eyewitnessClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: EYEWITNESS_GAME_ID,
    title: 'شاهد عيان',
    description: 'صف صورة خيالية ليرسمها الأصدقاء ثم اختاروا أفضل رسمة.',
    iconLabel: '👁',
    minPlayers: EYEWITNESS_MIN_PLAYERS,
    maxPlayers: EYEWITNESS_MAX_PLAYERS,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((module) => module.EyewitnessGameScreen),
  ),
};
