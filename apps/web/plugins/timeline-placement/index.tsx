'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';
import {
  TIMELINE_PLACEMENT_GAME_ID,
  TIMELINE_PLACEMENT_MAX_PLAYERS,
  TIMELINE_PLACEMENT_MIN_PLAYERS,
} from '@wanasatna/shared';

export const timelinePlacementClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: TIMELINE_PLACEMENT_GAME_ID,
    title: 'زمانها وين؟',
    description: 'ضع الحدث في مكانه الصحيح على الخط الزمني',
    iconLabel: '🕰️',
    minPlayers: TIMELINE_PLACEMENT_MIN_PLAYERS,
    maxPlayers: TIMELINE_PLACEMENT_MAX_PLAYERS,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((module) => module.TimelinePlacementGameScreen),
  ),
};
