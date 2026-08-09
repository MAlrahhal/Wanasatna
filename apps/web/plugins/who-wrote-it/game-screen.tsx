'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GamePluginScreenProps, WhoWroteItPlayerView } from '@wanasatna/shared';
import { WHO_WROTE_IT_GAME_ID } from '@wanasatna/shared';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { mapWhoWroteItLeaderboard } from '@/lib/game/map-who-wrote-it-leaderboard';
import { WHO_WROTE_IT_GAME_ICON, WHO_WROTE_IT_GAME_NAME } from '@/lib/game/who-wrote-it-brand';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { WhoWroteItAnsweringScreen } from './answering-screen';
import { WhoWroteItGuessingScreen } from './guessing-screen';
import { WhoWroteItRoundResultsScreen } from './round-results-screen';
import { useWhoWroteItPlayerView } from './use-player-view';

export function WhoWroteItGameScreen(_props: GamePluginScreenProps) {
  const { state: shellState, returnToLobby } = useGameShell();
  const { room, player, players, isHost } = useRoom();
  const setExperienceMeta = useSetGameExperienceMeta();
  const isWhoWroteIt = shellState?.gameId === WHO_WROTE_IT_GAME_ID;
  const shellPhase = shellState?.phase;
  const pluginEnabled = isWhoWroteIt && shellPhase === 'PLAYING';
  const [finalResultsView, setFinalResultsView] = useState<WhoWroteItPlayerView | null>(null);
  const [isReturningToLobby, setIsReturningToLobby] = useState(false);

  const {
    view,
    errorMessage,
    isLoading,
    actionError,
    isSubmittingAction,
    submitAnswer,
    submitOwnerGuess,
    continueFromRoundResults,
    setNextRoundCategory,
  } = useWhoWroteItPlayerView(pluginEnabled);

  const activeFinalResultsView =
    finalResultsView ?? (view?.gamePhase === 'match-completed' ? view : null);

  const showFinalMatchResults =
    isWhoWroteIt &&
    activeFinalResultsView !== null &&
    (shellPhase === 'PLAYING' || shellPhase === 'FINISHED');

  useEffect(() => {
    if (view?.gamePhase === 'match-completed') {
      setFinalResultsView(view);
    }
  }, [view]);

  useEffect(() => {
    const activeView = activeFinalResultsView ?? view;
    const experienceEnabled = isWhoWroteIt && (pluginEnabled || showFinalMatchResults);

    if (!experienceEnabled || !player) {
      setExperienceMeta(null);
      return;
    }

    if (!activeView) {
      setExperienceMeta({
        gameName: WHO_WROTE_IT_GAME_NAME,
        gameIcon: WHO_WROTE_IT_GAME_ICON,
        phaseLabel: 'جاري التحميل...',
        leaderboardEntries: mapWhoWroteItLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: WHO_WROTE_IT_GAME_NAME,
      gameIcon: WHO_WROTE_IT_GAME_ICON,
      phaseLabel: activeView.phaseLabel,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      leaderboardEntries: mapWhoWroteItLeaderboard(activeView, player.id, players),
    });
  }, [
    activeFinalResultsView,
    isWhoWroteIt,
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
        gameName={WHO_WROTE_IT_GAME_NAME}
        returnStatusMessage={returnStatusMessage}
        isReturnToLobbyLoading={isReturningToLobby}
        onReturnToLobby={isHost && shellFinished ? handleReturnToLobby : undefined}
      />
    );
  }

  if (!pluginEnabled) {
    return null;
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
      <section className="rounded-2xl border border-destructive/40 bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-destructive">{errorMessage}</p>
      </section>
    );
  }

  if (!view || !room || !player) {
    return null;
  }

  if (view.gamePhase === 'answering' && view.question) {
    return (
      <WhoWroteItAnsweringScreen
        question={view.question}
        canSubmit={view.canSubmitAnswer}
        hasSubmitted={view.hasSubmittedAnswer}
        submittedCount={view.submittedAnswerCount}
        totalSlots={view.totalAnswerSlots}
        isSubmitting={isSubmittingAction}
        actionError={actionError}
        onSubmit={(answer) => void submitAnswer(answer)}
      />
    );
  }

  if (view.gamePhase === 'guessing') {
    return (
      <WhoWroteItGuessingScreen
        question={view.question ?? ''}
        currentAnswer={view.currentAnonymousAnswer}
        options={view.guessOptions}
        progressIndex={view.guessingProgressIndex}
        progressTotal={view.guessingProgressTotal}
        isOwnAnswer={view.isOwnAnswer}
        hasGuessedCurrent={view.hasGuessedCurrentAnswer}
        canSubmitGuess={view.canSubmitGuess}
        currentGuessCount={view.currentAnswerGuessCount}
        requiredGuessCount={view.currentAnswerRequiredGuessCount}
        isSubmitting={isSubmittingAction}
        actionError={actionError}
        onGuess={(answerId, ownerPlayerId) => void submitOwnerGuess(answerId, ownerPlayerId)}
      />
    );
  }

  if (view.gamePhase === 'round-results') {
    return (
      <div className="space-y-3">
        <WhoWroteItRoundResultsScreen
          revealEntries={view.revealEntries}
          roundResults={view.roundResults}
          currentPlayerId={player.id}
          roundNumber={view.currentRound}
          totalRounds={view.totalRounds}
          roomCode={room.code}
          isHost={view.isHost}
          nextCategoryId={view.nextCategoryId}
          onSelectNextCategory={(categoryId) => void setNextRoundCategory(categoryId)}
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
