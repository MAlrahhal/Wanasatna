'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { WhoWroteItGameScreen } from './game-screen';

export const whoWroteItClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: 'who-wrote-it',
    title: 'من كتبها؟',
    description: 'خمّن مين كتب الجملة بين إجابات اللاعبين.',
    iconLabel: 'م',
    minPlayers: 3,
  },
  GameScreen: WhoWroteItGameScreen,
};
