'use client';

import type { WebClientGamePlugin } from '@/lib/game-plugins/types';
import { lazyGameScreen } from '@/lib/game-plugins/lazy-game-screen';
import {
  EMOJI_LANGUAGE_GAME_ID,
  EMOJI_LANGUAGE_MAX_PLAYERS,
  EMOJI_LANGUAGE_MIN_PLAYERS,
} from '@wanasatna/shared';

export const emojiLanguageClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: EMOJI_LANGUAGE_GAME_ID,
    title: 'لغة الإيموجي',
    description: 'حوّل المعنى إلى رموز وافهم تلميحات الآخرين',
    iconLabel: '😀',
    minPlayers: EMOJI_LANGUAGE_MIN_PLAYERS,
    maxPlayers: EMOJI_LANGUAGE_MAX_PLAYERS,
  },
  GameScreen: lazyGameScreen(() =>
    import('./game-screen').then((module) => module.EmojiLanguageGameScreen),
  ),
};
