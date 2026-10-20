'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';
import { SECRET_AGENTS_GAME_ID } from '@wanasatna/shared';

export const secretAgentsClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: SECRET_AGENTS_GAME_ID,
    title: 'العملاء السريون',
    description: 'اربط الكلمات بتلميح واحد واحذر القاتل',
    iconLabel: 'س',
    minPlayers: 4,
    maxPlayers: 15,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((module) => module.SecretAgentsGameScreen),
  ),
};
