'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GamePluginScreenProps, TimingChallengePlayerView } from '@wanasatna/shared';
import { TIMING_CHALLENGE_GAME_ID } from '@wanasatna/shared';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import {
  TIMING_CHALLENGE_GAME_ICON,
  TIMING_CHALLENGE_GAME_NAME,
} from '@/lib/game/timing-challenge-brand';
import { mapTimingChallengeLeaderboard } from '@/lib/game/map-timing-challenge-leaderboard';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { GuessScreen } from './guess-screen';
import { HiddenTimingScreen } from './hidden-timing-screen';
import { ReadyScreen } from './ready-screen';
import { TimingChallengeRoundResultsScreen } from './round-results-screen';
import { StopTimerScreen } from './stop-timer-screen';
import { useTimingChallengePlayerView } from './use-player-view';

export function TimingChallengeGameScreen(_props: GamePluginScreenProps) {
  const { state: shellState, returnToLobby } = useGameShell();
  const { room, player, players, isHost } = useRoom();
  const setExperienceMeta = useSetGameExperienceMeta();
  const isTiming = shellState?.gameId === TIMING_CHALLENGE_GAME_ID;
  const shellPhase = shellState?.phase;
  const pluginEnabled = isTiming && shellPhase === 'PLAYING';
  const [finalResultsView, setFinalResultsView] = useState<TimingChallengePlayerView | null>(null);
  const [isReturningToLobby, setIsReturningToLobby] = useState(false);

  const {
    view,
    errorMessage,
    isLoading,
    actionError,
    isSubmittingAction,
    markReady,
    submitGuess,
    startTimer,
    stopTimer,
    continueFromRoundResults,
  } = useTimingChallengePlayerView(pluginEnabled);

  const activeFinalResultsView =
    finalResultsView ?? (view?.gamePhase === 'match-completed' ? view : null);

  const showFinalMatchResults =
    isTiming &&
    activeFinalResultsView !== null &&
    (shellPhase === 'PLAYING' || shellPhase === 'FINISHED');

  useEffect(() => {
    if (view?.gamePhase === 'match-completed') {
      setFinalResultsView(view);
    }
  }, [view]);

  useEffect(() => {
    const activeView = activeFinalResultsView ?? view;
    const experienceEnabled = isTiming && (pluginEnabled || showFinalMatchResults);

    if (!experienceEnabled || !player) {
      setExperienceMeta(null);
      return;
    }

    if (!activeView) {
      setExperienceMeta({
        gameName: TIMING_CHALLENGE_GAME_NAME,
        gameIcon: TIMING_CHALLENGE_GAME_ICON,
        phaseLabel: 'جاري التحميل...',
        leaderboardEntries: mapTimingChallengeLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: TIMING_CHALLENGE_GAME_NAME,
      gameIcon: TIMING_CHALLENGE_GAME_ICON,
      phaseLabel: activeView.phaseLabel,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      leaderboardEntries: mapTimingChallengeLeaderboard(activeView, player.id, players),
    });
  }, [
    activeFinalResultsView,
    isTiming,
    player,
    players,
    pluginEnabled,
    setExperienceMeta,
    showFinalMatchResults,
    view,
  ]);

  useEffect(() => () => setExperienceMeta(null), [setExperienceMeta]);

  const handleReturnToLobby = useCallback(() => {
    if (!isHost || shellPhase !== 'FINISHED' || isReturningToLobby) {
      return;
    }

    setIsReturningToLobby(true);
    void returnToLobby().finally(() => {
      setIsReturningToLobby(false);
    });
  }, [isHost, isReturningToLobby, returnToLobby, shellPhase]);

  if (showFinalMatchResults && room && player && activeFinalResultsView) {
    const shellFinished = shellPhase === 'FINISHED';
    const returnStatusMessage = !shellFinished
      ? 'جاري إنهاء المباراة...'
      : !isHost
        ? 'بانتظار المضيف للعودة إلى اللوبي.'
        : null;

    return (
      <MatchResultsScreen
        leaderboard={activeFinalResultsView.resultsLeaderboard.map((entry) => ({
          id: entry.playerId,
          name: entry.name,
          totalPoints: entry.totalPoints,
          rank: entry.rank,
          isFirstPlace: entry.isFirstPlace,
          isCurrentPlayer: entry.playerId === player.id,
        }))}
        currentPlayerId={player.id}
        totalRounds={activeFinalResultsView.totalRounds}
        playerCount={activeFinalResultsView.resultsLeaderboard.length}
        roomCode={room.code}
        gameName={TIMING_CHALLENGE_GAME_NAME}
        returnStatusMessage={returnStatusMessage}
        isReturnToLobbyLoading={isReturningToLobby}
        onReturnToLobby={isHost && shellFinished ? handleReturnToLobby : undefined}
      />
    );
  }

  if (!pluginEnabled) {
    return null;
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">جاري تحميل اللعبة...</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
        <p className="text-sm text-destructive">{errorMessage}</p>
      </section>
    );
  }

  if (!view || !room || !player) {
    return null;
  }

  if (view.gamePhase === 'ready') {
    return (
      <ReadyScreen
        mode={view.mode}
        targetMs={view.targetMs}
        canReady={view.canReady}
        selfReady={view.selfReady}
        peers={view.peers}
        currentPlayerId={player.id}
        isSubmitting={isSubmittingAction}
        onReady={() => void markReady()}
      />
    );
  }

  if (view.gamePhase === 'hidden-timing') {
    return <HiddenTimingScreen />;
  }

  if (view.gamePhase === 'guessing') {
    return (
      <GuessScreen
        canGuess={view.canGuess}
        selfSubmitted={view.selfSubmitted}
        peers={view.peers}
        currentPlayerId={player.id}
        isSubmitting={isSubmittingAction}
        actionError={actionError}
        onSubmit={(guessSeconds) => void submitGuess(guessSeconds)}
      />
    );
  }

  if (view.gamePhase === 'stop-timer' && view.targetMs !== null) {
    return (
      <StopTimerScreen
        targetMs={view.targetMs}
        canStartTimer={view.canStartTimer}
        canStopTimer={view.canStopTimer}
        selfTimerRunning={view.selfTimerRunning}
        selfSubmitted={view.selfSubmitted}
        selfElapsedMs={view.selfElapsedMs}
        selfSignedDeltaMs={view.selfSignedDeltaMs}
        selfErrorMs={view.selfErrorMs}
        peers={view.peers}
        currentPlayerId={player.id}
        isSubmitting={isSubmittingAction}
        actionError={actionError}
        onStart={() => void startTimer()}
        onStop={() => void stopTimer()}
      />
    );
  }

  if (view.gamePhase === 'round-results' && view.targetMs !== null) {
    return (
      <div className="space-y-3">
        <TimingChallengeRoundResultsScreen
          mode={view.mode}
          targetMs={view.targetMs}
          roundResults={view.roundResults}
          currentPlayerId={player.id}
          roundNumber={view.currentRound}
          totalRounds={view.totalRounds}
          roomCode={room.code}
          continueLabel={view.canContinueFromRoundResults ? view.roundResultsContinueLabel : null}
          waitingMessage={view.roundResultsWaitingMessage}
          isContinueLoading={isSubmittingAction}
          onContinue={
            view.canContinueFromRoundResults && !isSubmittingAction
              ? () => void continueFromRoundResults()
              : undefined
          }
        />
        {actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    );
  }

  return null;
}
