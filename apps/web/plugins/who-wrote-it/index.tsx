'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';

export const whoWroteItClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: 'who-wrote-it',
    title: 'من كتبها؟',
    description: 'خمّن مين كتب الجملة بين إجابات اللاعبين.',
    iconLabel: 'م',
    minPlayers: 3,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((mod) => mod.WhoWroteItGameScreen),
  ),
};
