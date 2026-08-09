'use client';

import { JUDGE_DEFAULT_ROUNDS } from '@wanasatna/shared';
import { useEffect } from 'react';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { JUDGE_GAME_ICON, JUDGE_GAME_NAME } from '@/lib/game/judge-brand';
import { CountdownScreen, type CountdownNumber } from '@/plugins/bara-al-salafa/countdown-screen';

function toCountdownNumber(seconds: number): CountdownNumber {
  if (seconds >= 3) {
    return 3;
  }
  if (seconds <= 1) {
    return 1;
  }
  return 2;
}

export function JudgeCountdownLive() {
  const { state } = useGameShell();
  const { room } = useRoom();
  const setMeta = useSetGameExperienceMeta();

  useEffect(() => {
    setMeta({
      gameName: JUDGE_GAME_NAME,
      gameIcon: JUDGE_GAME_ICON,
      phaseLabel: 'العد التنازلي',
      currentRound: 1,
      totalRounds: JUDGE_DEFAULT_ROUNDS,
      leaderboardEntries: null,
    });
    return () => setMeta(null);
  }, [setMeta]);

  if (
    !state ||
    !room ||
    state.countdownRemainingSeconds === null ||
    state.countdownRemainingSeconds <= 0
  ) {
    return null;
  }

  return (
    <CountdownScreen
      currentNumber={toCountdownNumber(state.countdownRemainingSeconds)}
      roundNumber={1}
      totalRounds={JUDGE_DEFAULT_ROUNDS}
      roomCode={room.code}
    />
  );
}
