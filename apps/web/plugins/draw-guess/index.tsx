'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';

export const drawGuessClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: 'draw-guess',
    title: 'ارسم وخمن',
    description: 'ارسم الكلمة وخمّن رسم باقي اللاعبين.',
    iconLabel: 'ر',
    minPlayers: 2,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((mod) => mod.DrawGuessGameScreen),
  ),
};
