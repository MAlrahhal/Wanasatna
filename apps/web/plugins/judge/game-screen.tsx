'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GamePluginScreenProps, JudgePlayerView } from '@wanasatna/shared';
import { JUDGE_GAME_ID } from '@wanasatna/shared';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { JUDGE_GAME_ICON, JUDGE_GAME_NAME } from '@/lib/game/judge-brand';
import { mapJudgeLeaderboard } from '@/lib/game/map-judge-leaderboard';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { JudgeAnsweringScreen } from './answering-screen';
import { JudgeJudgingScreen } from './judging-screen';
import { JudgeRoundResultsScreen } from './round-results-screen';
import { useJudgePlayerView } from './use-player-view';

export function JudgeGameScreen(_props: GamePluginScreenProps) {
  const { state: shellState, returnToLobby } = useGameShell();
  const { room, player, players, isHost } = useRoom();
  const setExperienceMeta = useSetGameExperienceMeta();
  const isJudgeGame = shellState?.gameId === JUDGE_GAME_ID;
  const shellPhase = shellState?.phase;
  const pluginEnabled = isJudgeGame && shellPhase === 'PLAYING';
  const [finalResultsView, setFinalResultsView] = useState<JudgePlayerView | null>(null);
  const [isReturningToLobby, setIsReturningToLobby] = useState(false);

  const {
    view,
    errorMessage,
    isLoading,
    actionError,
    isSubmittingAction,
    submitAnswer,
    selectWinner,
    continueFromRoundResults,
    setNextRoundCategory,
  } = useJudgePlayerView(pluginEnabled);

  const activeFinalResultsView =
    finalResultsView ?? (view?.gamePhase === 'match-completed' ? view : null);

  const showFinalMatchResults =
    isJudgeGame &&
    activeFinalResultsView !== null &&
    (shellPhase === 'PLAYING' || shellPhase === 'FINISHED');

  useEffect(() => {
    if (view?.gamePhase === 'match-completed') {
      setFinalResultsView(view);
    }
  }, [view]);

  useEffect(() => {
    const activeView = activeFinalResultsView ?? view;
    const experienceEnabled = isJudgeGame && (pluginEnabled || showFinalMatchResults);

    if (!experienceEnabled || !player) {
      setExperienceMeta(null);
      return;
    }

    if (!activeView) {
      setExperienceMeta({
        gameName: JUDGE_GAME_NAME,
        gameIcon: JUDGE_GAME_ICON,
        phaseLabel: 'جاري التحميل...',
        leaderboardEntries: mapJudgeLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: JUDGE_GAME_NAME,
      gameIcon: JUDGE_GAME_ICON,
      phaseLabel: activeView.phaseLabel,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      leaderboardEntries: mapJudgeLeaderboard(activeView, player.id, players),
    });
  }, [
    activeFinalResultsView,
    isJudgeGame,
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
        gameName={JUDGE_GAME_NAME}
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

  if (view.gamePhase === 'answering' && view.prompt) {
    return (
      <JudgeAnsweringScreen
        prompt={view.prompt}
        isJudge={view.isJudge}
        judgeName={view.judgeName}
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

  if (view.gamePhase === 'judging') {
    return (
      <JudgeJudgingScreen
        prompt={view.prompt ?? ''}
        answers={view.anonymousAnswers}
        isJudge={view.isJudge}
        canSelect={view.canSelectWinner}
        isSubmitting={isSubmittingAction}
        actionError={actionError}
        onSelectWinner={(answerId) => void selectWinner(answerId)}
      />
    );
  }

  if (view.gamePhase === 'round-results') {
    return (
      <div className="space-y-3">
        <JudgeRoundResultsScreen
          winningAnswerText={view.winningAnswerText}
          winnerName={view.winnerName}
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
