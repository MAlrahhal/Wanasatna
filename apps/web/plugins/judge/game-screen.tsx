'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GamePluginScreenProps, JudgePlayerView } from '@wanasatna/shared';
import {
  JUDGE_GAME_ID,
  JUDGE_ROUND_RESULTS_SECONDS,
  MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS,
} from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { GameSystemError, GameSystemLoading, SpectatorNotice } from '@/components/room/room-system-state';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { JUDGE_GAME_ICON, JUDGE_GAME_NAME } from '@/lib/game/judge-brand';
import { toExperienceTimer } from '@/lib/game/deadline-clock';
import { mapJudgeLeaderboard } from '@/lib/game/map-judge-leaderboard';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { JudgeAnsweringScreen } from './answering-screen';
import { JudgeJudgingScreen } from './judging-screen';
import { JudgeRoundResultsScreen } from './round-results-screen';
import { useJudgePlayerView } from './use-player-view';
import { useJudgeSfx } from './use-sfx';

const VISIBLE_TIMER_PHASES = new Set([
  'answering',
  'judging',
  'round-results',
  'match-completed',
]);

function SpectatorBanner() {
  return <SpectatorNotice />;
}

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
  } = useJudgePlayerView(pluginEnabled);

  useJudgeSfx(view, player?.id);

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
        phaseLabel: SYSTEM_COPY.loading,
        leaderboardEntries: mapJudgeLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: JUDGE_GAME_NAME,
      gameIcon: JUDGE_GAME_ICON,
      layoutMode: showFinalMatchResults
        ? 'final-results'
        : activeView.gamePhase === 'round-results'
          ? 'round-results'
          : 'gameplay',
      phaseLabel: activeView.isMatchSpectator ? SYSTEM_COPY.spectatorTitle : activeView.phaseLabel,
      centerLabel: activeView.judgeName ? `القاضي: ${activeView.judgeName}` : undefined,
      categoryLabel: activeView.categoryLabel
        ? `الفئة: ${activeView.categoryLabel}`
        : undefined,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      timer: VISIBLE_TIMER_PHASES.has(activeView.gamePhase)
        ? toExperienceTimer(activeView.deadlineAtMs, { format: 'seconds', lowTimeThreshold: 5 })
        : undefined,
      leaderboardEntries: activeView.isMatchSpectator
        ? []
        : mapJudgeLeaderboard(activeView, player.id, players),
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
      : !isHost
        ? 'بانتظار العودة التلقائية إلى اللوبي.'
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

  if (isLoading && !view) {
    return <GameSystemLoading />;
  }

  if (errorMessage && !view) {
    return <GameSystemError message={errorMessage} />;
  }

  if (!view || !room || !player) {
    return null;
  }

  if (view.isMatchSpectator) {
    if (view.gamePhase === 'answering' && view.prompt) {
      return (
        <div className="space-y-3">
          <JudgeAnsweringScreen
            prompt={view.prompt}
            isJudge={false}
            canSubmit={false}
            hasSubmitted={false}
            submittedCount={view.submittedAnswerCount}
            totalSlots={view.totalAnswerSlots}
            isSubmitting={false}
            isSpectator
          />
          <SpectatorBanner />
        </div>
      );
    }

    if (view.gamePhase === 'judging') {
      return (
        <div className="space-y-3">
          <JudgeJudgingScreen
            prompt={view.prompt ?? ''}
            answers={view.anonymousAnswers}
            isJudge={false}
            canSelect={false}
            isSubmitting={false}
            isSpectator
            onSelectWinner={() => undefined}
          />
          <SpectatorBanner />
        </div>
      );
    }

    if (view.gamePhase === 'round-results') {
      return (
        <JudgeRoundResultsScreen
          winningAnswerText={view.winningAnswerText}
          winnerName={view.winnerName}
          revealEntries={view.revealEntries}
          roundResults={view.roundResults}
          currentPlayerId={player.id}
          roundNumber={view.currentRound}
          totalRounds={view.totalRounds}
          roomCode={room.code}
          remainingSeconds={0}
          deadlineAtMs={view.deadlineAtMs}
          totalDurationSeconds={JUDGE_ROUND_RESULTS_SECONDS}
          waitingMessage={view.roundResultsWaitingMessage}
        />
      );
    }

    return (
      <GameScreen ariaLabel="مشاهدة">
        <GameHeader
          gameName={JUDGE_GAME_NAME}
          gameIcon={JUDGE_GAME_ICON}
          roomCode={room.code}
          currentRound={view.currentRound}
          totalRounds={view.totalRounds}
          phaseLabel={SYSTEM_COPY.spectatorTitle}
        />
        <SpectatorBanner />
      </GameScreen>
    );
  }

  if (view.gamePhase === 'answering' && view.prompt) {
    return (
      <JudgeAnsweringScreen
        prompt={view.prompt}
        isJudge={view.isJudge}
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
          remainingSeconds={0}
          deadlineAtMs={view.deadlineAtMs}
          totalDurationSeconds={JUDGE_ROUND_RESULTS_SECONDS}
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
