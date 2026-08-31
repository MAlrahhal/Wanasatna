'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GamePluginScreenProps, WhoWroteItPlayerView } from '@wanasatna/shared';
import {
  MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS,
  WHO_WROTE_IT_GAME_ID,
  WHO_WROTE_IT_ROUND_RESULTS_SECONDS,
} from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { GameSystemError, GameSystemLoading, SpectatorNotice } from '@/components/room/room-system-state';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { mapWhoWroteItLeaderboard } from '@/lib/game/map-who-wrote-it-leaderboard';
import { toExperienceTimer } from '@/lib/game/deadline-clock';
import { WHO_WROTE_IT_GAME_ICON, WHO_WROTE_IT_GAME_NAME } from '@/lib/game/who-wrote-it-brand';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { WhoWroteItAnsweringScreen } from './answering-screen';
import { WhoWroteItGuessingScreen } from './guessing-screen';
import { WhoWroteItRoundResultsScreen } from './round-results-screen';
import { useWhoWroteItPlayerView } from './use-player-view';
import { useWhoWroteItSfx } from './use-sfx';

const VISIBLE_TIMER_PHASES = new Set([
  'answering',
  'guessing',
  'round-results',
  'match-completed',
]);

function SpectatorBanner() {
  return <SpectatorNotice />;
}

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
  } = useWhoWroteItPlayerView(pluginEnabled);

  useWhoWroteItSfx(view, player?.id);

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
        phaseLabel: SYSTEM_COPY.loading,
        leaderboardEntries: mapWhoWroteItLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: WHO_WROTE_IT_GAME_NAME,
      gameIcon: WHO_WROTE_IT_GAME_ICON,
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
        ? toExperienceTimer(activeView.deadlineAtMs, { format: 'seconds', lowTimeThreshold: 5 })
        : undefined,
      leaderboardEntries: activeView.isMatchSpectator
        ? []
        : mapWhoWroteItLeaderboard(activeView, player.id, players),
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
        gameName={WHO_WROTE_IT_GAME_NAME}
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
    if (view.gamePhase === 'answering' && view.question) {
      return (
        <div className="space-y-3">
          <WhoWroteItAnsweringScreen
            question={view.question}
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

    if (view.gamePhase === 'guessing') {
      return (
        <div className="space-y-3">
          <WhoWroteItGuessingScreen
            currentAnswer={view.currentAnonymousAnswer}
            options={[]}
            progressIndex={view.guessingProgressIndex}
            progressTotal={view.guessingProgressTotal}
            isOwnAnswer={false}
            hasGuessedCurrent={false}
            canSubmitGuess={false}
            currentGuessCount={view.currentAnswerGuessCount}
            requiredGuessCount={view.currentAnswerRequiredGuessCount}
            isSubmitting={false}
            isSpectator
            onGuess={() => undefined}
          />
          <SpectatorBanner />
        </div>
      );
    }

    if (view.gamePhase === 'round-results') {
      return (
        <WhoWroteItRoundResultsScreen
          revealEntries={view.revealEntries}
          roundResults={view.roundResults}
          currentPlayerId={player.id}
          roundNumber={view.currentRound}
          totalRounds={view.totalRounds}
          roomCode={room.code}
          remainingSeconds={0}
          deadlineAtMs={view.deadlineAtMs}
          totalDurationSeconds={WHO_WROTE_IT_ROUND_RESULTS_SECONDS}
          waitingMessage={view.roundResultsWaitingMessage}
        />
      );
    }

    return (
      <GameScreen ariaLabel="مشاهدة">
        <GameHeader
          gameName={WHO_WROTE_IT_GAME_NAME}
          gameIcon={WHO_WROTE_IT_GAME_ICON}
          roomCode={room.code}
          currentRound={view.currentRound}
          totalRounds={view.totalRounds}
          phaseLabel={SYSTEM_COPY.spectatorTitle}
        />
        <SpectatorBanner />
      </GameScreen>
    );
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
          remainingSeconds={0}
          deadlineAtMs={view.deadlineAtMs}
          totalDurationSeconds={WHO_WROTE_IT_ROUND_RESULTS_SECONDS}
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
