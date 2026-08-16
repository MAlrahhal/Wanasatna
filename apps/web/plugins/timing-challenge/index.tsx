'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';

export const timingChallengeClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: 'timing-challenge',
    title: 'تحدي التوقيت',
    description: 'اختبر إحساسك بالوقت — خمّن أو أوقف المؤقت في اللحظة المناسبة.',
    iconLabel: 'ت',
    minPlayers: 2,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((mod) => mod.TimingChallengeGameScreen),
  ),
};
