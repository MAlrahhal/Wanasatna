'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';

export const fastAnswerClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: 'fast-answer',
    title: 'أسرع إجابة',
    description: 'أسئلة سريعة… أول واحد يجيب صح يكسب النقاط.',
    iconLabel: 'س',
    minPlayers: 2,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((mod) => mod.FastAnswerGameScreen),
  ),
};
