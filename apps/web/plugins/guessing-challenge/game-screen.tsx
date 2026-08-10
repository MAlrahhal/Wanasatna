'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GamePluginScreenProps, GuessingChallengePlayerView } from '@wanasatna/shared';
import { GUESSING_CHALLENGE_GAME_ID } from '@wanasatna/shared';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import {
  GUESSING_CHALLENGE_GAME_ICON,
  GUESSING_CHALLENGE_GAME_NAME,
} from '@/lib/game/guessing-challenge-brand';
import { mapGuessingChallengeLeaderboard } from '@/lib/game/map-guessing-challenge-leaderboard';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { GuessingChallengePlayingScreen } from './playing-screen';
import { GuessingChallengeRoundResultsScreen } from './round-results-screen';
import { useGuessingChallengePlayerView } from './use-player-view';

export function GuessingChallengeGameScreen(_props: GamePluginScreenProps) {
  const { state: shellState, returnToLobby } = useGameShell();
  const { room, player, players } = useRoom();
  const setExperienceMeta = useSetGameExperienceMeta();
  const isGuessingGame = shellState?.gameId === GUESSING_CHALLENGE_GAME_ID;
  const shellPhase = shellState?.phase;
  const pluginEnabled = isGuessingGame && shellPhase === 'PLAYING';
  const [finalResultsView, setFinalResultsView] = useState<GuessingChallengePlayerView | null>(
    null,
  );
  const [isReturningToLobby, setIsReturningToLobby] = useState(false);

  const {
    view,
    errorMessage,
    isLoading,
    actionError,
    guessFeedback,
    isSubmittingAction,
    endQuestion,
    submitFinalGuess,
    useYellowCard,
    useRedCard,
    rejectCard,
    continueFromRoundResults,
    setNextRoundCategory,
    emitLook,
  } = useGuessingChallengePlayerView(pluginEnabled);

  const activeFinalResultsView =
    finalResultsView ?? (view?.gamePhase === 'match-completed' ? view : null);

  const showFinalMatchResults =
    isGuessingGame &&
    activeFinalResultsView !== null &&
    (shellPhase === 'PLAYING' || shellPhase === 'FINISHED');

  useEffect(() => {
    if (view?.gamePhase === 'match-completed') {
      setFinalResultsView(view);
    }
  }, [view]);

  useEffect(() => {
    const activeView = activeFinalResultsView ?? view;
    const experienceEnabled = isGuessingGame && (pluginEnabled || showFinalMatchResults);

    if (!experienceEnabled || !player) {
      setExperienceMeta(null);
      return;
    }

    if (!activeView) {
      setExperienceMeta({
        gameName: GUESSING_CHALLENGE_GAME_NAME,
        gameIcon: GUESSING_CHALLENGE_GAME_ICON,
        phaseLabel: 'جاري التحميل...',
        leaderboardEntries: mapGuessingChallengeLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: GUESSING_CHALLENGE_GAME_NAME,
      gameIcon: GUESSING_CHALLENGE_GAME_ICON,
      phaseLabel: activeView.phaseLabel,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      leaderboardEntries: mapGuessingChallengeLeaderboard(activeView, player.id, players),
    });
  }, [
    activeFinalResultsView,
    isGuessingGame,
    player,
    players,
    pluginEnabled,
    setExperienceMeta,
    showFinalMatchResults,
    view,
  ]);

  const handleReturnToLobby = useCallback(async () => {
    if (isReturningToLobby) {
      return;
    }
    setIsReturningToLobby(true);
    await returnToLobby();
    setIsReturningToLobby(false);
  }, [isReturningToLobby, returnToLobby]);

  if (!isGuessingGame || !room || !player) {
    return null;
  }

  if (showFinalMatchResults && activeFinalResultsView) {
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
        gameName={GUESSING_CHALLENGE_GAME_NAME}
        isReturnToLobbyLoading={isReturningToLobby}
        onReturnToLobby={
          activeFinalResultsView.isHost
            ? () => {
                void handleReturnToLobby();
              }
            : undefined
        }
        returnStatusMessage={
          activeFinalResultsView.isHost ? null : 'بانتظار المضيف للعودة إلى اللوبي...'
        }
      />
    );
  }

  if (isLoading && !view) {
    return (
      <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">جاري تحميل اللعبة...</p>
      </section>
    );
  }

  if (errorMessage && !view) {
    return (
      <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-rose-300">{errorMessage}</p>
      </section>
    );
  }

  if (!view) {
    return null;
  }

  if (view.gamePhase === 'round-results') {
    return (
      <GuessingChallengeRoundResultsScreen
        view={view}
        currentPlayerId={player.id}
        roomCode={room.code}
        isContinueLoading={isSubmittingAction}
        onContinue={continueFromRoundResults}
        onSelectNextCategory={(categoryId) => {
          void setNextRoundCategory(categoryId);
        }}
      />
    );
  }

  return (
    <GuessingChallengePlayingScreen
      view={view}
      roomCode={room.code}
      actionError={actionError}
      guessFeedback={guessFeedback}
      isSubmittingAction={isSubmittingAction}
      onEndQuestion={endQuestion}
      onSubmitGuess={submitFinalGuess}
      onUseYellow={useYellowCard}
      onUseRed={useRedCard}
      onRejectCard={rejectCard}
      onLookChange={emitLook}
    />
  );
}
