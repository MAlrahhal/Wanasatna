'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { BaraAlSalafaGameScreen } from './game-screen';

export const baraAlSalafaClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: 'bara-al-salafa',
    title: 'برا السالفة',
    description: 'اكتشف من برا السالفة قبل ما ينكشف!',
    iconLabel: 'ب',
    minPlayers: 3,
    maxPlayers: 12,
  },
  GameScreen: BaraAlSalafaGameScreen,
};

export { BaraAlSalafaGameScreen } from './game-screen';
export { useBaraAlSalafaPlayerView } from './use-player-view';
