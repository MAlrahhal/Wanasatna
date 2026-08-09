'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { JudgeGameScreen } from './game-screen';

export const judgeClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: 'judge',
    title: 'القاضي',
    description: 'القاضي يحكم… والباقي يحاولون يقنعونه.',
    iconLabel: 'ق',
    minPlayers: 3,
  },
  GameScreen: JudgeGameScreen,
};
