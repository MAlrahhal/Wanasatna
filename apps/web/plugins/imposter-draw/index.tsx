'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { ImposterDrawGameScreen } from './game-screen';

export const imposterDrawClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: 'imposter-draw',
    title: 'الإمبوستر بالرسم',
    description: 'امبوستر يحاول يتموّه… والباقي يحاولون يكشفونه.',
    iconLabel: 'إ',
    minPlayers: 3,
  },
  GameScreen: ImposterDrawGameScreen,
};
