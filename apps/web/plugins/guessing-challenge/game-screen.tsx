'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GamePluginScreenProps, GuessingChallengePlayerView } from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_ROUND_RESULTS_SECONDS,
  MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS,
} from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import {
  GUESSING_CHALLENGE_GAME_ICON,
  GUESSING_CHALLENGE_GAME_NAME,
} from '@/lib/game/guessing-challenge-brand';
import { mapGuessingChallengeLeaderboard } from '@/lib/game/map-guessing-challenge-leaderboard';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { GameplayScene } from './gameplay-scene';
import { GuessingChallengePlayingScreen } from './playing-screen';
import { GuessingChallengeRoundResultsScreen } from './round-results-screen';
import { useGuessingChallengePlayerView } from './use-player-view';

function conciseGuessingChallengePhaseLabel(view: GuessingChallengePlayerView): string {
  if (view.isMatchSpectator) {
    return 'مشاهدة';
  }
  if (view.gamePhase === 'round-results') {
    return 'نتائج الجولة';
  }
  if (view.gamePhase === 'match-completed') {
    return 'النتائج النهائية';
  }
  if (view.isMyTurn) {
    return 'دورك';
  }
  if (view.currentTurnPlayerName) {
    return `دور ${view.currentTurnPlayerName}`;
  }
  return 'التخمين';
}

export function GuessingChallengeGameScreen(_props: GamePluginScreenProps) {
  const { state: shellState, returnToLobby } = useGameShell();
  const { room, player, players, isHost } = useRoom();
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
    remainingSeconds,
    endQuestion,
    submitFinalGuess,
    useYellowCard,
    useRedCard,
    rejectCard,
    continueFromRoundResults,
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
      phaseLabel: conciseGuessingChallengePhaseLabel(activeView),
      categoryLabel: activeView.categoryLabel
        ? `الفئة: ${activeView.categoryLabel}`
        : undefined,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      timer: {
        remainingSeconds,
        format: 'seconds' as const,
        lowTimeThreshold: 5,
      },
      leaderboardEntries: mapGuessingChallengeLeaderboard(activeView, player.id, players),
    });
  }, [
    activeFinalResultsView,
    isGuessingGame,
    player,
    players,
    pluginEnabled,
    remainingSeconds,
    setExperienceMeta,
    showFinalMatchResults,
    view,
  ]);

  const handleReturnToLobby = useCallback(async () => {
    if (isReturningToLobby) {
      return;
    }
    setIsReturningToLobby(true);
    if (view?.gamePhase === 'match-completed' && isHost) {
      await continueFromRoundResults();
    } else {
      await returnToLobby();
    }
    setIsReturningToLobby(false);
  }, [
    continueFromRoundResults,
    isHost,
    isReturningToLobby,
    returnToLobby,
    view?.gamePhase,
  ]);

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
        autoReturnSeconds={
          activeFinalResultsView.gamePhase === 'match-completed'
            ? remainingSeconds
            : undefined
        }
        autoReturnTotalSeconds={
          activeFinalResultsView.gamePhase === 'match-completed'
            ? MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS
            : undefined
        }
        isReturnToLobbyLoading={isReturningToLobby}
        onReturnToLobby={
          activeFinalResultsView.isHost
            ? () => {
                void handleReturnToLobby();
              }
            : undefined
        }
        returnStatusMessage={
          activeFinalResultsView.isHost
            ? null
            : 'العودة إلى اللوبي تلقائياً خلال ثوانٍ...'
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

  if (view.isMatchSpectator && view.gamePhase === 'playing') {
    return (
      <GameScreen ariaLabel="مشاهدة تحدي التخمين" maxWidth="4xl" className="min-w-0 gap-3 sm:gap-4">
        <p className="text-center text-sm font-semibold text-wanas-text-muted">
          أنت مشاهد حالياً
        </p>
        <GameplayScene
          mode="playing"
          matchMode={view.mode}
          opponentName={view.currentTurnPlayerName ?? 'لاعب'}
          selfName="مشاهد"
          opponentIdentity={null}
          selfIdentity={null}
          selfHidden
          isMyTurn={false}
          turnTitle={`دور ${view.currentTurnPlayerName ?? 'فريق'}`}
          turnInstruction="راقب الدور الحالي. لا يمكنك التخمين أو استخدام البطاقات."
          showSpecialCards={false}
        />
      </GameScreen>
    );
  }

  if (view.gamePhase === 'round-results') {
    return (
      <GuessingChallengeRoundResultsScreen
        view={view}
        currentPlayerId={player.id}
        roomCode={room.code}
        isContinueLoading={isSubmittingAction}
        remainingSeconds={remainingSeconds}
        totalDurationSeconds={GUESSING_CHALLENGE_ROUND_RESULTS_SECONDS}
        onContinue={continueFromRoundResults}
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
