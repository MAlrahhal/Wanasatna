'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { GuessingChallengeGameScreen } from './game-screen';

export const guessingChallengeClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: 'guessing-challenge',
    title: 'تحدي التخمين',
    description: 'اعرف هويتك قبل خصمك',
    iconLabel: 'ت',
    minPlayers: 2,
    maxPlayers: 4,
  },
  GameScreen: GuessingChallengeGameScreen,
};
