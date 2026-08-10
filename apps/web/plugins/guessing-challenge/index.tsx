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
    teamCapability: {
      enabled: true,
      teamIds: ['blue', 'red'],
      capacityByMode: { '1v1': 1, '2v2': 2 },
      defaultMode: '1v1',
    },
  },
  GameScreen: GuessingChallengeGameScreen,
};
