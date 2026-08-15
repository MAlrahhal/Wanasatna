'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GamePluginScreenProps, ImposterDrawPlayerView } from '@wanasatna/shared';
import {
  IMPOSTER_DRAW_GAME_ID,
  IMPOSTER_DRAW_ROUND_RESULTS_SECONDS,
  MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS,
} from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { GameSystemError, GameSystemLoading, SpectatorNotice } from '@/components/room/room-system-state';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { IMPOSTER_DRAW_GAME_ICON, IMPOSTER_DRAW_GAME_NAME } from '@/lib/game/imposter-draw-brand';
import { mapImposterDrawLeaderboard } from '@/lib/game/map-imposter-draw-leaderboard';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { ImpostorGuessScreen } from '@/plugins/bara-al-salafa/impostor-guess-screen';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { VotingScreen } from '@/plugins/bara-al-salafa/voting-screen';
import { ImposterDrawBriefingScreen } from './briefing-screen';
import { DrawingTurnsScreen } from './drawing-turns-screen';
import { ImposterDrawRevealScreen } from './reveal-screen';
import { ImposterDrawRoundResultsScreen } from './round-results-screen';
import { useImposterDrawPlayerView } from './use-player-view';
import { useImposterDrawSfx } from './use-sfx';

const TIMED_PHASES = new Set([
  'briefing',
  'drawing-turns',
  'voting',
  'reveal',
  'impostor-guess',
  'guess-result',
  'round-results',
  'match-completed',
]);

function toLobbyPlayers(
  votablePlayers: ImposterDrawPlayerView['votablePlayers'],
  currentPlayerId: string,
  currentPlayerName: string,
): LobbyPlayer[] {
  return [
    {
      id: currentPlayerId,
      name: currentPlayerName,
      isHost: false,
      isSpectator: false,
      isConnected: true,
    },
    ...votablePlayers.map((player) => ({
      id: player.playerId,
      name: player.name,
      isHost: false,
      isSpectator: false,
      isConnected: true,
    })),
  ];
}

export function ImposterDrawGameScreen(_props: GamePluginScreenProps) {
  const { state: shellState, returnToLobby } = useGameShell();
  const { room, player, players, isHost } = useRoom();
  const setExperienceMeta = useSetGameExperienceMeta();
  const isImposterDraw = shellState?.gameId === IMPOSTER_DRAW_GAME_ID;
  const shellPhase = shellState?.phase;
  const pluginEnabled = isImposterDraw && shellPhase === 'PLAYING';
  const [finalResultsView, setFinalResultsView] = useState<ImposterDrawPlayerView | null>(null);
  const [isReturningToLobby, setIsReturningToLobby] = useState(false);
  const [selectedVoteTargetId, setSelectedVoteTargetId] = useState<string | null>(null);
  const [selectedGuessWord, setSelectedGuessWord] = useState<string | null>(null);

  const {
    view,
    errorMessage,
    isLoading,
    remainingSeconds,
    actionError,
    isSubmittingAction,
    submitRoleUnderstood,
    undoStroke,
    submitVote,
    submitImageGuess,
    continueFromRoundResults,
    emitStroke,
    emitStrokePoints,
  } = useImposterDrawPlayerView(pluginEnabled);

  useImposterDrawSfx(view, player?.id, remainingSeconds);

  const activeFinalResultsView =
    finalResultsView ?? (view?.gamePhase === 'match-completed' ? view : null);

  const showFinalMatchResults =
    isImposterDraw &&
    activeFinalResultsView !== null &&
    (shellPhase === 'PLAYING' || shellPhase === 'FINISHED');

  useEffect(() => {
    if (view?.gamePhase === 'match-completed') {
      setFinalResultsView(view);
    }
  }, [view]);

  useEffect(() => {
    if (view?.gamePhase !== 'voting') {
      setSelectedVoteTargetId(null);
    }

    if (view?.gamePhase !== 'impostor-guess') {
      setSelectedGuessWord(null);
    }
  }, [view?.gamePhase]);

  useEffect(() => {
    const activeView = activeFinalResultsView ?? view;
    const experienceEnabled = isImposterDraw && (pluginEnabled || showFinalMatchResults);

    if (!experienceEnabled || !player) {
      setExperienceMeta(null);
      return;
    }

    if (!activeView) {
      setExperienceMeta({
        gameName: IMPOSTER_DRAW_GAME_NAME,
        gameIcon: IMPOSTER_DRAW_GAME_ICON,
        phaseLabel: SYSTEM_COPY.loading,
        leaderboardEntries: mapImposterDrawLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: IMPOSTER_DRAW_GAME_NAME,
      gameIcon: IMPOSTER_DRAW_GAME_ICON,
      phaseLabel: activeView.isMatchSpectator ? 'مشاهدة' : activeView.phaseLabel,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      timer: TIMED_PHASES.has(activeView.gamePhase)
        ? { remainingSeconds, format: 'seconds' as const, lowTimeThreshold: 5 }
        : undefined,
      leaderboardEntries: activeView.isMatchSpectator
        ? []
        : mapImposterDrawLeaderboard(activeView, player.id, players),
    });
  }, [
    activeFinalResultsView,
    isImposterDraw,
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

  const guessOptions = useMemo(
    () =>
      (view?.impostorGuessOptions ?? []).map((label) => ({
        id: label,
        emoji: '🖼️',
        label,
      })),
    [view?.impostorGuessOptions],
  );

  if (showFinalMatchResults && room && player && activeFinalResultsView) {
    const shellFinished = shellPhase === 'FINISHED';
    const isMatchCompletedPhase = activeFinalResultsView.gamePhase === 'match-completed';
    const autoReturnMessage = isMatchCompletedPhase
      ? `العودة إلى اللوبي تلقائياً خلال ${Math.max(0, remainingSeconds)} ثانية`
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
        gameName={IMPOSTER_DRAW_GAME_NAME}
        returnStatusMessage={
          isHost && (isMatchCompletedPhase || shellFinished) ? null : autoReturnMessage
        }
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
    return <GameSystemLoading />;
  }

  if (errorMessage) {
    return <GameSystemError message={errorMessage} />;
  }

  if (!view || !room || !player) {
    return null;
  }

  if (view.isMatchSpectator) {
    if (view.gamePhase === 'drawing-turns') {
      return (
        <DrawingTurnsScreen
          strokes={view.strokes}
          canDraw={false}
          isSpectator
          currentDrawerName={view.currentDrawerName}
          remainingSeconds={remainingSeconds}
          currentRound={view.currentRound}
          totalRounds={view.totalRounds}
          roomCode={room.code}
        />
      );
    }

    return (
      <GameScreen ariaLabel="مشاهدة">
        <GameHeader
          gameName={IMPOSTER_DRAW_GAME_NAME}
          gameIcon={IMPOSTER_DRAW_GAME_ICON}
          roomCode={room.code}
          currentRound={view.currentRound}
          totalRounds={view.totalRounds}
          phaseLabel="مشاهدة"
          timer={{ remainingSeconds, format: 'seconds', lowTimeThreshold: 5 }}
        />
        <SpectatorNotice />
      </GameScreen>
    );
  }

  if (view.gamePhase === 'briefing') {
    return (
      <ImposterDrawBriefingScreen
        role={view.role}
        referenceImage={view.referenceImage}
        remainingSeconds={remainingSeconds}
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        roomCode={room.code}
        acknowledged={view.hasAcknowledgedBriefing}
        isSubmitting={isSubmittingAction}
        onAcknowledge={
          view.hasAcknowledgedBriefing || isSubmittingAction
            ? undefined
            : () => void submitRoleUnderstood()
        }
      />
    );
  }

  if (view.gamePhase === 'drawing-turns') {
    return (
      <DrawingTurnsScreen
        strokes={view.strokes}
        canDraw={view.canDraw}
        currentDrawerName={view.currentDrawerName}
        remainingSeconds={remainingSeconds}
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        roomCode={room.code}
        actionError={actionError}
        onUndo={view.canDraw ? () => void undoStroke() : undefined}
        onEmitStroke={(payload) => void emitStroke(payload)}
        onEmitStrokePoints={(payload) => void emitStrokePoints(payload)}
      />
    );
  }

  if (view.gamePhase === 'voting') {
    return (
      <VotingScreen
        players={toLobbyPlayers(view.votablePlayers, player.id, player.name)}
        currentPlayerId={player.id}
        selectedPlayerId={selectedVoteTargetId}
        confirmedPlayerId={view.confirmedVoteTargetPlayerId}
        hasVoted={view.hasVoted}
        submittedVotesCount={view.submittedVotesCount}
        eligibleVotersCount={view.eligibleVotersCount}
        roundNumber={view.currentRound}
        totalRounds={view.totalRounds}
        roomCode={room.code}
        gameName={IMPOSTER_DRAW_GAME_NAME}
        gameIcon={IMPOSTER_DRAW_GAME_ICON}
        questionTitle="من هو الإمبوستر؟"
        questionHelper=""
        remainingSeconds={remainingSeconds}
        showTimer
        isSubmitting={isSubmittingAction}
        errorMessage={actionError}
        onSelectPlayer={setSelectedVoteTargetId}
        onConfirmVote={() => {
          if (selectedVoteTargetId) {
            void submitVote(selectedVoteTargetId);
          }
        }}
      />
    );
  }

  if (view.gamePhase === 'reveal' && view.revealedImpostorName && view.revealedImpostorPlayerId) {
    return (
      <ImposterDrawRevealScreen
        impostorName={view.revealedImpostorName}
        impostorPlayerId={view.revealedImpostorPlayerId}
        impostorVotedOut={view.impostorVotedOut}
        remainingSeconds={remainingSeconds}
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        roomCode={room.code}
      />
    );
  }

  if (view.gamePhase === 'impostor-guess') {
    return (
      <ImpostorGuessScreen
        isImpostor={view.role === 'impostor'}
        options={guessOptions}
        selectedWord={selectedGuessWord ?? view.selectedImageGuess}
        hasSubmitted={view.hasSubmittedImageGuess}
        roundNumber={view.currentRound}
        totalRounds={view.totalRounds}
        roomCode={room.code}
        gameName={IMPOSTER_DRAW_GAME_NAME}
        gameIcon={IMPOSTER_DRAW_GAME_ICON}
        phaseLabel="تخمين الصورة"
        remainingSeconds={remainingSeconds}
        showTimer
        showOptionsToObservers={false}
        waitingTitle="الإمبوستر يحاول تخمين الصورة..."
        waitingHelper="انتظر نتيجة التخمين."
        heroTitle="وش الصورة؟"
        heroHelper="اختر الإجابة الصحيحة دون معرفة الصورة مسبقاً."
        onSelectWord={view.role === 'impostor' ? setSelectedGuessWord : undefined}
        onSubmit={
          view.role === 'impostor'
            ? () => {
                if (selectedGuessWord) {
                  void submitImageGuess(selectedGuessWord);
                }
              }
            : undefined
        }
      />
    );
  }

  if (view.gamePhase === 'guess-result') {
    return (
      <GameScreen ariaLabel="نتيجة التخمين">
        <GameHeader
          gameName={IMPOSTER_DRAW_GAME_NAME}
          gameIcon={IMPOSTER_DRAW_GAME_ICON}
          roomCode={room.code}
          currentRound={view.currentRound}
          totalRounds={view.totalRounds}
          phaseLabel="نتيجة التخمين"
          timer={{ remainingSeconds, format: 'seconds', lowTimeThreshold: 2 }}
        />
        <GameCard className="px-5 py-12 text-center">
          <p className="text-3xl font-bold text-wanas-text-primary">
            {view.guessResultMessage ?? 'إجابة خاطئة!'}
          </p>
        </GameCard>
      </GameScreen>
    );
  }

  if (view.gamePhase === 'round-results' && view.revealedImpostorName) {
    return (
      <div className="space-y-4">
        <ImposterDrawRoundResultsScreen
          impostorName={view.revealedImpostorName}
          impostorVotedOut={view.impostorVotedOut}
          impostorGuessedCorrectly={view.impostorGuessedCorrectly}
          selectedImageGuess={view.selectedImageGuess}
          revealedAnswerLabel={view.revealedAnswerLabel}
          playersWon={view.playersWon}
          roundResults={view.roundResults}
          currentPlayerId={player.id}
          roundNumber={view.currentRound}
          totalRounds={view.totalRounds}
          roomCode={room.code}
          remainingSeconds={remainingSeconds}
          totalDurationSeconds={IMPOSTER_DRAW_ROUND_RESULTS_SECONDS}
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
