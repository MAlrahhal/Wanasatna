'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';

export const baraAlSalafaClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: 'bara-al-salafa',
    title: 'برا السالفة',
    description: 'اكتشف من برا السالفة قبل ما ينكشف!',
    iconLabel: 'ب',
    minPlayers: 3,
    maxPlayers: 20,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((mod) => mod.BaraAlSalafaGameScreen),
  ),
};
