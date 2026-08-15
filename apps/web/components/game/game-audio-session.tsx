'use client';

import { useGameAudioSession } from '@/lib/game/use-game-audio-session';

export function GameAudioSession() {
  useGameAudioSession();
  return null;
}
