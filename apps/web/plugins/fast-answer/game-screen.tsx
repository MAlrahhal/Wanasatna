'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FastAnswerPlayerView, GamePluginScreenProps } from '@wanasatna/shared';
import {
  FAST_ANSWER_GAME_ID,
  FAST_ANSWER_ROUND_RESULTS_SECONDS,
  MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS,
} from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { GameSystemError, GameSystemLoading, SpectatorNotice } from '@/components/room/room-system-state';
import { FAST_ANSWER_GAME_ICON, FAST_ANSWER_GAME_NAME } from '@/lib/game/fast-answer-brand';
import { toExperienceTimer } from '@/lib/game/deadline-clock';
import { mapFastAnswerLeaderboard } from '@/lib/game/map-fast-answer-leaderboard';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { FastAnswerQuestionScreen } from './question-screen';
import { FastAnswerRoundResultsScreen } from './round-results-screen';
import { useFastAnswerPlayerView, resolveFastAnswerDeadlineAtMs } from './use-player-view';
import { useFastAnswerSfx } from './use-sfx';

const VISIBLE_TIMER_PHASES = new Set(['question', 'round-results', 'match-completed']);

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
    submitAnswer,
    continueFromRoundResults,
  } = useFastAnswerPlayerView(pluginEnabled);

  useFastAnswerSfx(view, player?.id);

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
        phaseLabel: SYSTEM_COPY.loading,
        leaderboardEntries: mapFastAnswerLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: FAST_ANSWER_GAME_NAME,
      gameIcon: FAST_ANSWER_GAME_ICON,
      layoutMode: showFinalMatchResults
        ? 'final-results'
        : activeView.gamePhase === 'round-results'
          ? 'round-results'
          : 'gameplay',
      phaseLabel: activeView.isMatchSpectator ? SYSTEM_COPY.spectatorTitle : activeView.phaseLabel,
      categoryLabel: activeView.categoryLabel
        ? `الفئة: ${activeView.categoryLabel}`
        : undefined,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      timer: VISIBLE_TIMER_PHASES.has(activeView.gamePhase)
        ? toExperienceTimer(resolveFastAnswerDeadlineAtMs(activeView), {
            format: 'seconds',
            lowTimeThreshold: 5,
          })
        : undefined,
      leaderboardEntries: activeView.isMatchSpectator
        ? []
        : mapFastAnswerLeaderboard(activeView, player.id, players),
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
    if (isReturningToLobby) {
      return;
    }

    if (view?.gamePhase === 'match-completed' && isHost) {
      setIsReturningToLobby(true);
      void continueFromRoundResults().finally(() => {
        setIsReturningToLobby(false);
      });
      return;
    }

    if (!isHost || shellPhase !== 'FINISHED') {
      return;
    }

    setIsReturningToLobby(true);
    void returnToLobby().finally(() => {
      setIsReturningToLobby(false);
    });
  }, [
    continueFromRoundResults,
    isHost,
    isReturningToLobby,
    returnToLobby,
    shellPhase,
    view?.gamePhase,
  ]);

  if (showFinalMatchResults && room && player && activeFinalResultsView) {
    const shellFinished = shellPhase === 'FINISHED';
    const isMatchCompletedPhase = activeFinalResultsView.gamePhase === 'match-completed';
    const autoReturnMessage = isMatchCompletedPhase
      ? null
      : !shellFinished
        ? SYSTEM_COPY.returningToLobby
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
        returnStatusMessage={
          isHost && (isMatchCompletedPhase || shellFinished) ? null : autoReturnMessage
        }
        autoReturnDeadlineAtMs={isMatchCompletedPhase ? activeFinalResultsView.deadlineAtMs : undefined}
        autoReturnTotalSeconds={
          isMatchCompletedPhase ? MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS : undefined
        }
        isReturnToLobbyLoading={isReturningToLobby}
        onReturnToLobby={
          isHost && (isMatchCompletedPhase || shellFinished) ? handleReturnToLobby : undefined
        }
      />
    );
  }

  if (!pluginEnabled) {
    return null;
  }

  if (isLoading) {
    return <GameSystemLoading />;
  }

  if (errorMessage) {
    return <GameSystemError message={errorMessage} />;
  }

  if (!view || !room || !player) {
    return null;
  }

  if (view.isMatchSpectator) {
    if (view.gamePhase === 'question' && view.question) {
      return (
        <div className="space-y-3">
          <FastAnswerQuestionScreen
            question={view.question}
            canSubmit={false}
            isSubmitting={false}
          />
          <SpectatorNotice />
        </div>
      );
    }

    if (view.gamePhase === 'round-results' && view.revealedAnswer !== null) {
      return (
        <FastAnswerRoundResultsScreen
          revealedAnswer={view.revealedAnswer}
          timedOut={view.timedOut}
          winnerName={view.winnerName}
          roundResults={view.roundResults}
          currentPlayerId={player.id}
          roundNumber={view.currentRound}
          totalRounds={view.totalRounds}
          roomCode={room.code}
          remainingSeconds={0}
          deadlineAtMs={view.deadlineAtMs}
          totalDurationSeconds={FAST_ANSWER_ROUND_RESULTS_SECONDS}
          waitingMessage={view.roundResultsWaitingMessage}
        />
      );
    }

    return (
      <GameScreen ariaLabel="مشاهدة">
        <GameHeader
          gameName={FAST_ANSWER_GAME_NAME}
          gameIcon={FAST_ANSWER_GAME_ICON}
          roomCode={room.code}
          currentRound={view.currentRound}
          totalRounds={view.totalRounds}
          phaseLabel={SYSTEM_COPY.spectatorTitle}
        />
        <SpectatorNotice />
      </GameScreen>
    );
  }

  if (view.gamePhase === 'question' && view.question) {
    return (
      <FastAnswerQuestionScreen
        question={view.question}
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
          remainingSeconds={0}
          deadlineAtMs={view.deadlineAtMs}
          totalDurationSeconds={FAST_ANSWER_ROUND_RESULTS_SECONDS}
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
