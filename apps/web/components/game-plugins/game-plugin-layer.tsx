'use client';

import {
  BARA_AL_SALAFA_GAME_ID,
  DRAW_GUESS_GAME_ID,
  FAST_ANSWER_GAME_ID,
  IMPOSTER_DRAW_GAME_ID,
  JUDGE_GAME_ID,
  TIMING_CHALLENGE_GAME_ID,
  WHO_WROTE_IT_GAME_ID,
} from '@wanasatna/shared';
import { GameExperienceShell } from '@/components/game-experience/game-experience-shell';
import { GameExperienceProvider } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { BaraAlSalafaCountdownLive } from '@/plugins/bara-al-salafa/bara-al-salafa-countdown-live';
import { DrawGuessCountdownLive } from '@/plugins/draw-guess/draw-guess-countdown-live';
import { FastAnswerCountdownLive } from '@/plugins/fast-answer/fast-answer-countdown-live';
import { ImposterDrawCountdownLive } from '@/plugins/imposter-draw/imposter-draw-countdown-live';
import { JudgeCountdownLive } from '@/plugins/judge/judge-countdown-live';
import { TimingChallengeCountdownLive } from '@/plugins/timing-challenge/timing-challenge-countdown-live';
import { WhoWroteItCountdownLive } from '@/plugins/who-wrote-it/who-wrote-it-countdown-live';
import { GamePluginRenderer } from './game-plugin-renderer';

function usesPluginExperienceShell(gameId: string): boolean {
  return (
    gameId === BARA_AL_SALAFA_GAME_ID ||
    gameId === DRAW_GUESS_GAME_ID ||
    gameId === IMPOSTER_DRAW_GAME_ID ||
    gameId === TIMING_CHALLENGE_GAME_ID ||
    gameId === FAST_ANSWER_GAME_ID ||
    gameId === WHO_WROTE_IT_GAME_ID ||
    gameId === JUDGE_GAME_ID
  );
}

function CountdownForGame({ gameId }: { gameId: string }) {
  if (gameId === DRAW_GUESS_GAME_ID) {
    return <DrawGuessCountdownLive />;
  }

  if (gameId === IMPOSTER_DRAW_GAME_ID) {
    return <ImposterDrawCountdownLive />;
  }

  if (gameId === TIMING_CHALLENGE_GAME_ID) {
    return <TimingChallengeCountdownLive />;
  }

  if (gameId === FAST_ANSWER_GAME_ID) {
    return <FastAnswerCountdownLive />;
  }

  if (gameId === WHO_WROTE_IT_GAME_ID) {
    return <WhoWroteItCountdownLive />;
  }

  if (gameId === JUDGE_GAME_ID) {
    return <JudgeCountdownLive />;
  }

  return <BaraAlSalafaCountdownLive />;
}

function PluginMatchStarting() {
  return (
    <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">جاري بدء اللعبة...</p>
    </section>
  );
}

/**
 * Renders the active game plugin UI inside the shared live-game experience shell.
 */
export function GamePluginLayer() {
  const { state } = useGameShell();
  const { player, isHost } = useRoom();

  if (!state?.gameId || !player) {
    return null;
  }

  const pluginGame = usesPluginExperienceShell(state.gameId);
  const shellActive =
    pluginGame &&
    (state.phase === 'WAITING' ||
      state.phase === 'COUNTDOWN' ||
      state.phase === 'PLAYING' ||
      state.phase === 'FINISHED');

  let pluginContent = null;

  if (pluginGame && state.phase === 'WAITING') {
    pluginContent = <PluginMatchStarting />;
  } else if (state.phase === 'COUNTDOWN' && pluginGame) {
    pluginContent = <CountdownForGame gameId={state.gameId} />;
  } else if (state.phase === 'PLAYING') {
    pluginContent = <GamePluginRenderer gameId={state.gameId} isHost={isHost} />;
  } else if (state.phase === 'FINISHED' && pluginGame) {
    pluginContent = <GamePluginRenderer gameId={state.gameId} isHost={isHost} />;
  }

  if (!pluginContent) {
    return null;
  }

  return (
    <GameExperienceProvider shellActive={shellActive}>
      <GameExperienceShell>{pluginContent}</GameExperienceShell>
    </GameExperienceProvider>
  );
}
