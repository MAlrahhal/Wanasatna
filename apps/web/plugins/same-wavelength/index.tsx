'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';
import {
  SAME_WAVELENGTH_GAME_ID,
  SAME_WAVELENGTH_MAX_PLAYERS,
  SAME_WAVELENGTH_MIN_PLAYERS,
} from '@wanasatna/shared';

export const sameWavelengthClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: SAME_WAVELENGTH_GAME_ID,
    title: 'على نفس الموجة',
    description: 'تلميح واحد ونقطة سرية بين مفهومين متعاكسين',
    iconLabel: '〰️',
    minPlayers: SAME_WAVELENGTH_MIN_PLAYERS,
    maxPlayers: SAME_WAVELENGTH_MAX_PLAYERS,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((module) => module.SameWavelengthGameScreen),
  ),
};
