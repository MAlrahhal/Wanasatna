'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DrawGuessPlayerView, GamePluginScreenProps } from '@wanasatna/shared';
import {
  DRAW_GUESS_GAME_ID,
  DRAW_GUESS_ROUND_RESULTS_DURATION_SECONDS,
  MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS,
} from '@wanasatna/shared';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { DRAW_GUESS_GAME_ICON, DRAW_GUESS_GAME_NAME } from '@/lib/game/draw-guess-brand';
import { mapDrawGuessLeaderboard } from '@/lib/game/map-draw-guess-leaderboard';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { DrawingScreen } from './drawing-screen';
import { DrawGuessRoundResultsScreen } from './round-results-screen';
import { WaitingSpectatorScreen } from './waiting-spectator-screen';
import { useDrawGuessPlayerView } from './use-player-view';

const TIMED_DRAW_GUESS_PHASES = new Set(['drawing', 'round-results', 'match-completed']);

export function DrawGuessGameScreen(_props: GamePluginScreenProps) {
  const { state: shellState, returnToLobby } = useGameShell();
  const { room, player, players, isHost } = useRoom();
  const setExperienceMeta = useSetGameExperienceMeta();
  const isDrawGuess = shellState?.gameId === DRAW_GUESS_GAME_ID;
  const shellPhase = shellState?.phase;
  const pluginEnabled = isDrawGuess && shellPhase === 'PLAYING';
  const [finalResultsView, setFinalResultsView] = useState<DrawGuessPlayerView | null>(null);
  const [isReturningToLobby, setIsReturningToLobby] = useState(false);
  const {
    view,
    errorMessage,
    isLoading,
    remainingSeconds,
    actionError,
    guessFeedback,
    isSubmittingAction,
    submitGuess,
    clearCanvas,
    undoStroke,
    continueFromRoundResults,
    emitStroke,
    emitStrokePoints,
  } = useDrawGuessPlayerView(pluginEnabled);

  const activeFinalResultsView =
    finalResultsView ?? (view?.gamePhase === 'match-completed' ? view : null);

  const showFinalMatchResults =
    isDrawGuess &&
    activeFinalResultsView !== null &&
    (shellPhase === 'PLAYING' || shellPhase === 'FINISHED');

  useEffect(() => {
    if (view?.gamePhase === 'match-completed') {
      setFinalResultsView(view);
    }
  }, [view]);

  useEffect(() => {
    const activeView = activeFinalResultsView ?? view;
    const experienceEnabled = isDrawGuess && (pluginEnabled || showFinalMatchResults);

    if (!experienceEnabled || !player) {
      setExperienceMeta(null);
      return;
    }

    if (!activeView) {
      setExperienceMeta({
        gameName: DRAW_GUESS_GAME_NAME,
        gameIcon: DRAW_GUESS_GAME_ICON,
        phaseLabel: 'جاري التحميل...',
        leaderboardEntries: mapDrawGuessLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: DRAW_GUESS_GAME_NAME,
      gameIcon: DRAW_GUESS_GAME_ICON,
      phaseLabel: activeView.phaseLabel,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      timer: TIMED_DRAW_GUESS_PHASES.has(activeView.gamePhase)
        ? { remainingSeconds, format: 'seconds' as const, lowTimeThreshold: 10 }
        : undefined,
      leaderboardEntries: mapDrawGuessLeaderboard(activeView, player.id, players),
    });
  }, [
    activeFinalResultsView,
    isDrawGuess,
    player,
    players,
    pluginEnabled,
    remainingSeconds,
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
      ? `العودة إلى اللوبي تلقائياً خلال ${Math.max(0, remainingSeconds)} ثانية`
      : !shellFinished
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
        gameName={DRAW_GUESS_GAME_NAME}
        returnStatusMessage={isHost && (isMatchCompletedPhase || shellFinished) ? null : autoReturnMessage}
        autoReturnSeconds={isMatchCompletedPhase ? remainingSeconds : undefined}
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

  if (view.isMatchSpectator) {
    return (
      <WaitingSpectatorScreen
        strokes={view.strokes}
        drawerName={view.drawerName}
        remainingSeconds={remainingSeconds}
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        roomCode={room.code}
      />
    );
  }

  if (view.gamePhase === 'round-results') {
    if (!view.revealedWord) {
      return (
        <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">جاري تحميل نتائج الجولة...</p>
        </section>
      );
    }

    return (
      <div className="space-y-4">
        <DrawGuessRoundResultsScreen
          revealedWord={view.revealedWord}
          guessedCorrectly={view.guessedCorrectly}
          correctGuesserName={view.correctGuesserName}
          drawerName={view.drawerName}
          roundResults={view.roundResults}
          currentPlayerId={player.id}
          roundNumber={view.currentRound}
          totalRounds={view.totalRounds}
          roomCode={room.code}
          remainingSeconds={remainingSeconds}
          totalDurationSeconds={DRAW_GUESS_ROUND_RESULTS_DURATION_SECONDS}
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

  if (view.gamePhase === 'drawing') {
    return (
      <DrawingScreen
        strokes={view.strokes}
        isDrawer={view.role === 'drawer'}
        secretWord={view.role === 'drawer' ? view.secretWord : null}
        drawerName={view.drawerName}
        remainingSeconds={remainingSeconds}
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        roomCode={room.code}
        canGuess={view.canGuess}
        isSubmittingAction={isSubmittingAction}
        actionError={actionError}
        guessFeedback={guessFeedback}
        onSubmitGuess={(guess) => void submitGuess(guess)}
        onClearCanvas={() => void clearCanvas()}
        onUndo={() => void undoStroke()}
        onEmitStroke={(payload) => void emitStroke(payload)}
        onEmitStrokePoints={(payload) => void emitStrokePoints(payload)}
      />
    );
  }

  return null;
}
