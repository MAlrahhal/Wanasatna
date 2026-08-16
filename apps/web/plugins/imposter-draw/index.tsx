'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';

export const imposterDrawClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: 'imposter-draw',
    title: 'الإمبوستر بالرسم',
    description: 'امبوستر يحاول يتموّه… والباقي يحاولون يكشفونه.',
    iconLabel: 'إ',
    minPlayers: 3,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((mod) => mod.ImposterDrawGameScreen),
  ),
};
