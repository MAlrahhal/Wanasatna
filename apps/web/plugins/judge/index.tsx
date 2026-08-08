'use client';

import type { GamePluginScreenProps } from '@wanasatna/shared';
import { GamePluginPlaceholder } from '@/components/game-plugins/game-plugin-placeholder';
import type { WebClientGamePlugin } from '@/lib/game-plugins/types';

function JudgeGameScreen(_props: GamePluginScreenProps) {
  return <GamePluginPlaceholder title="القاضي" />;
}

export const judgeClientPlugin: WebClientGamePlugin = {
  metadata: {
    id: 'judge',
    title: 'القاضي',
    description: 'القاضي يحكم… والباقي يحاولون يقنعونه.',
    iconLabel: 'ق',
  },
  GameScreen: JudgeGameScreen,
};
