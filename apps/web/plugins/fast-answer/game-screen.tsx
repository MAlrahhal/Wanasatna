'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FastAnswerPlayerView, GamePluginScreenProps } from '@wanasatna/shared';
import { FAST_ANSWER_GAME_ID } from '@wanasatna/shared';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { FAST_ANSWER_GAME_ICON, FAST_ANSWER_GAME_NAME } from '@/lib/game/fast-answer-brand';
import { mapFastAnswerLeaderboard } from '@/lib/game/map-fast-answer-leaderboard';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { FastAnswerQuestionScreen } from './question-screen';
import { FastAnswerRoundResultsScreen } from './round-results-screen';
import { useFastAnswerPlayerView } from './use-player-view';

export function FastAnswerGameScreen(_props: GamePluginScreenProps) {
  const { state: shellState, returnToLobby } = useGameShell();
  const { room, player, players, isHost } = useRoom();
  const setExperienceMeta = useSetGameExperienceMeta();
  const isFastAnswer = shellState?.gameId === FAST_ANSWER_GAME_ID;
  const shellPhase = shellState?.phase;
  const pluginEnabled = isFastAnswer && shellPhase === 'PLAYING';
  const [finalResultsView, setFinalResultsView] = useState<FastAnswerPlayerView | null>(null);
  const [isReturningToLobby, setIsReturningToLobby] = useState(false);

  const {
    view,
    errorMessage,
    isLoading,
    actionError,
    incorrectFeedback,
    isSubmittingAction,
    remainingSeconds,
    submitAnswer,
    continueFromRoundResults,
    setNextRoundCategory,
  } = useFastAnswerPlayerView(pluginEnabled);

  const activeFinalResultsView =
    finalResultsView ?? (view?.gamePhase === 'match-completed' ? view : null);

  const showFinalMatchResults =
    isFastAnswer &&
    activeFinalResultsView !== null &&
    (shellPhase === 'PLAYING' || shellPhase === 'FINISHED');

  useEffect(() => {
    if (view?.gamePhase === 'match-completed') {
      setFinalResultsView(view);
    }
  }, [view]);

  useEffect(() => {
    const activeView = activeFinalResultsView ?? view;
    const experienceEnabled = isFastAnswer && (pluginEnabled || showFinalMatchResults);

    if (!experienceEnabled || !player) {
      setExperienceMeta(null);
      return;
    }

    if (!activeView) {
      setExperienceMeta({
        gameName: FAST_ANSWER_GAME_NAME,
        gameIcon: FAST_ANSWER_GAME_ICON,
        phaseLabel: 'جاري التحميل...',
        leaderboardEntries: mapFastAnswerLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: FAST_ANSWER_GAME_NAME,
      gameIcon: FAST_ANSWER_GAME_ICON,
      phaseLabel: activeView.phaseLabel,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      leaderboardEntries: mapFastAnswerLeaderboard(activeView, player.id, players),
    });
  }, [
    activeFinalResultsView,
    isFastAnswer,
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
        gameName={FAST_ANSWER_GAME_NAME}
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

  if (view.gamePhase === 'question' && view.question) {
    return (
      <FastAnswerQuestionScreen
        question={view.question}
        remainingSeconds={remainingSeconds}
        canSubmit={view.canSubmitAnswer}
        isSubmitting={isSubmittingAction}
        incorrectFeedback={incorrectFeedback}
        actionError={actionError}
        onSubmit={(answer) => void submitAnswer(answer)}
      />
    );
  }

  if (view.gamePhase === 'round-results' && view.revealedAnswer !== null) {
    return (
      <div className="space-y-3">
        <FastAnswerRoundResultsScreen
          revealedAnswer={view.revealedAnswer}
          timedOut={view.timedOut}
          winnerName={view.winnerName}
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
