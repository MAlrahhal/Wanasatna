'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BaraAlSalafaPlayerView, GamePluginScreenProps } from '@wanasatna/shared';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';
import { mapBaraAlSalafaLeaderboard } from '@/lib/game/map-bara-leaderboard';
import { DirectedQuestionsScreen } from './directed-questions-screen';
import { FreeQuestionsScreen } from './free-questions-screen';
import { ImpostorGuessScreen } from './impostor-guess-screen';
import {
  mapDirectedQuestionsLiveProps,
  mapImpostorGuessLiveProps,
  mapMatchResultsLiveProps,
  mapRevealImpostorLiveProps,
  mapRoundResultsLiveProps,
  mapVotingLiveProps,
  resolveFreeQuestionActivePlayerId,
} from './live-phase-adapters';
import { MatchResultsScreen } from './match-results-screen';
import { RevealImpostorScreen } from './reveal-impostor-screen';
import { RoleRevealScreen } from './role-reveal-screen';
import { RoundResultsScreen } from './round-results-screen';
import { VotingScreen } from './voting-screen';
import { useBaraAlSalafaPlayerView } from './use-player-view';

const TIMED_BARA_PHASES = new Set(['description', 'reveal-impostor']);

export function BaraAlSalafaGameScreen(_props: GamePluginScreenProps) {
  const { state: shellState, returnToLobby } = useGameShell();
  const { room, player, players, isHost } = useRoom();
  const setExperienceMeta = useSetGameExperienceMeta();
  const isBaraAlSalafa = shellState?.gameId === 'bara-al-salafa';
  const shellPhase = shellState?.phase;
  const pluginEnabled = isBaraAlSalafa && shellPhase === 'PLAYING';
  const [guessSelection, setGuessSelection] = useState<string | null>(null);
  const [freeQuestionSelection, setFreeQuestionSelection] = useState<string | null>(null);
  const [voteSelection, setVoteSelection] = useState<string | null>(null);
  const [finalResultsView, setFinalResultsView] = useState<BaraAlSalafaPlayerView | null>(null);
  const [isReturningToLobby, setIsReturningToLobby] = useState(false);
  const {
    view,
    errorMessage,
    isLoading,
    remainingSeconds,
    actionError,
    isSubmittingAction,
    submitRoleUnderstood,
    advanceDirectedQuestion,
    continueFromRoundResults,
    chooseFreeQuestionPlayer,
    skipFreeQuestionTurn,
    advanceFreeQuestion,
    submitVote,
    submitImpostorGuess,
  } = useBaraAlSalafaPlayerView(pluginEnabled);

  const activeFinalResultsView =
    finalResultsView ?? (view?.gamePhase === 'match-completed' ? view : null);

  const showFinalMatchResults =
    isBaraAlSalafa &&
    activeFinalResultsView !== null &&
    (shellPhase === 'PLAYING' || shellPhase === 'FINISHED');

  useEffect(() => {
    if (view?.gamePhase === 'match-completed') {
      setFinalResultsView(view);
    }
  }, [view]);

  useEffect(() => {
    setFreeQuestionSelection(null);
  }, [view?.gamePhase, view?.activeFreeQuestionPlayerId, view?.activeFreeQuestionTargetPlayerId]);

  useEffect(() => {
    setVoteSelection(null);
  }, [view?.gamePhase, view?.hasVoted]);

  useEffect(() => {
    setGuessSelection(null);
  }, [view?.gamePhase, view?.hasSubmittedImpostorGuess]);

  useEffect(() => {
    const activeView = activeFinalResultsView ?? view;
    const experienceEnabled =
      isBaraAlSalafa && (pluginEnabled || showFinalMatchResults);

    if (!experienceEnabled || !player) {
      setExperienceMeta(null);
      return;
    }

    if (!activeView) {
      setExperienceMeta({
        gameName: 'برا السالفة',
        gameIcon: BARA_AL_SALAFA_GAME_ICON,
        phaseLabel: 'جاري التحميل...',
        leaderboardEntries: mapBaraAlSalafaLeaderboard(null, player.id, players),
      });
      return;
    }

    setExperienceMeta({
      gameName: 'برا السالفة',
      gameIcon: BARA_AL_SALAFA_GAME_ICON,
      phaseLabel: activeView.phaseLabel,
      currentRound: activeView.currentRound,
      totalRounds: activeView.totalRounds,
      timer: TIMED_BARA_PHASES.has(activeView.gamePhase)
        ? { remainingSeconds, format: 'seconds' as const, lowTimeThreshold: 10 }
        : undefined,
      leaderboardEntries: mapBaraAlSalafaLeaderboard(activeView, player.id, players),
    });
  }, [
    activeFinalResultsView,
    isBaraAlSalafa,
    player,
    players,
    pluginEnabled,
    remainingSeconds,
    setExperienceMeta,
    showFinalMatchResults,
    view,
  ]);

  useEffect(() => () => setExperienceMeta(null), [setExperienceMeta]);

  const handleFreeQuestionConfirm = useCallback(() => {
    if (!freeQuestionSelection || isSubmittingAction) {
      return;
    }

    void chooseFreeQuestionPlayer(freeQuestionSelection);
  }, [chooseFreeQuestionPlayer, freeQuestionSelection, isSubmittingAction]);

  const handleFreeQuestionSkip = useCallback(() => {
    if (isSubmittingAction) {
      return;
    }

    void skipFreeQuestionTurn();
  }, [isSubmittingAction, skipFreeQuestionTurn]);

  const handleConfirmVote = useCallback(() => {
    if (!voteSelection || isSubmittingAction || view?.hasVoted) {
      return;
    }

    void submitVote(voteSelection);
  }, [isSubmittingAction, submitVote, view?.hasVoted, voteSelection]);

  const handleSubmitImpostorGuess = useCallback(() => {
    if (!guessSelection || isSubmittingAction || view?.hasSubmittedImpostorGuess) {
      return;
    }

    void submitImpostorGuess(guessSelection);
  }, [guessSelection, isSubmittingAction, submitImpostorGuess, view?.hasSubmittedImpostorGuess]);

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
        {...mapMatchResultsLiveProps(activeFinalResultsView, player.id, room.code)}
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
        <p className="text-sm text-muted-foreground">جاري تحميل دورك...</p>
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

  if (!view) {
    return null;
  }

  if (view.gamePhase === 'round-results') {
    if (!room || !player) {
      return null;
    }

    const roundResultsProps = mapRoundResultsLiveProps(
      view,
      player.id,
      room.code,
      remainingSeconds,
    );

    if (!roundResultsProps) {
      return (
        <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">جاري تحميل نتائج الجولة...</p>
        </section>
      );
    }

    return (
      <div className="space-y-4">
        <RoundResultsScreen
          {...roundResultsProps}
          onContinue={
            view.canContinueFromRoundResults && !isSubmittingAction
              ? () => void continueFromRoundResults()
              : undefined
          }
          isContinueLoading={isSubmittingAction}
        />
        {actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    );
  }

  if (view.gamePhase === 'reveal-impostor') {
    if (!room) {
      return null;
    }

    const revealImpostorProps = mapRevealImpostorLiveProps(view, room.code, remainingSeconds);

    if (!revealImpostorProps) {
      return (
        <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">جاري تحميل كشف برا السالفة...</p>
        </section>
      );
    }

    return <RevealImpostorScreen {...revealImpostorProps} />;
  }

  if (view.gamePhase === 'impostor-guess') {
    if (!room) {
      return null;
    }

    const impostorGuessProps = mapImpostorGuessLiveProps(view, room.code);

    return (
      <div className="space-y-4">
        <ImpostorGuessScreen
          {...impostorGuessProps}
          selectedWord={guessSelection}
          onSelectWord={
            impostorGuessProps.isImpostor &&
            !impostorGuessProps.hasSubmitted &&
            !isSubmittingAction
              ? setGuessSelection
              : undefined
          }
          onSubmit={
            impostorGuessProps.isImpostor &&
            !impostorGuessProps.hasSubmitted &&
            !isSubmittingAction
              ? handleSubmitImpostorGuess
              : undefined
          }
        />
        {actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    );
  }

  if (view.gamePhase === 'voting') {
    if (!room || !player) {
      return null;
    }

    const votingProps = mapVotingLiveProps(
      view,
      players,
      player.id,
      room.code,
      remainingSeconds,
      isSubmittingAction,
      actionError,
    );

    return (
      <VotingScreen
        {...votingProps}
        selectedPlayerId={voteSelection}
        onSelectPlayer={
          !view.hasVoted && !isSubmittingAction ? setVoteSelection : undefined
        }
        onConfirmVote={
          !view.hasVoted && !isSubmittingAction ? handleConfirmVote : undefined
        }
      />
    );
  }

  if (view.gamePhase === 'description') {
    if (!room || !player) {
      return null;
    }

    const role = view.role === 'impostor' ? 'impostor' : 'normal';

    return (
      <RoleRevealScreen
        gameName="برا السالفة"
        currentRound={view.currentRound}
        totalRounds={view.totalRounds}
        remainingSeconds={remainingSeconds}
        roomCode={room.code}
        role={role}
        secretWord={view.role === 'player' ? view.displayText : undefined}
        players={players}
        currentPlayerId={player.id}
        onAcknowledge={
          !view.hasAcknowledgedRole && !isSubmittingAction
            ? () => void submitRoleUnderstood()
            : undefined
        }
        acknowledged={view.hasAcknowledgedRole}
        roleAcknowledgementCount={view.roleAcknowledgementCount}
        eligibleRoleAcknowledgementCount={view.eligibleRoleAcknowledgementCount}
        showFallbackTimer={remainingSeconds > 0}
      />
    );
  }

  if (view.gamePhase === 'directed-questions') {
    if (!room || !player) {
      return null;
    }

    const directedQuestionsProps = mapDirectedQuestionsLiveProps(
      view,
      players,
      player.id,
      room.code,
      remainingSeconds,
    );

    if (!directedQuestionsProps) {
      return (
        <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">جاري تحميل مرحلة الأسئلة الموجّهة...</p>
        </section>
      );
    }

    return (
      <div className="space-y-4">
        <DirectedQuestionsScreen
          {...directedQuestionsProps}
          isSubmittingAdvance={isSubmittingAction}
          onAdvanceNext={
            view.isDirectedQuestionActiveAsker && !isSubmittingAction
              ? () => void advanceDirectedQuestion()
              : undefined
          }
        />
        {actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    );
  }

  if (view.gamePhase === 'free-questions') {
    if (!room || !player) {
      return null;
    }

    const activePlayerId = resolveFreeQuestionActivePlayerId(view, player.id, players);

    if (!activePlayerId) {
      return (
        <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">جاري تحميل مرحلة الأسئلة الحرة...</p>
        </section>
      );
    }

    const participatingPlayers = players.filter((participant) => !participant.isSpectator);
    const activePlayer = participatingPlayers.find((participant) => participant.id === activePlayerId);
    const activePlayerName =
      view.activeFreeQuestionPlayerName ?? activePlayer?.name ?? 'اللاعب';
    const isActivePlayer = view.isFreeQuestionActivePlayer;
    const isConversationActive = Boolean(view.activeFreeQuestionTargetPlayerId);

    return (
      <div className="space-y-4">
        <FreeQuestionsScreen
          players={participatingPlayers}
          currentPlayerId={player.id}
          activePlayerId={activePlayerId}
          activePlayerName={activePlayerName}
          isActivePlayer={isActivePlayer}
          conversationTargetPlayerId={view.activeFreeQuestionTargetPlayerId}
          conversationTargetPlayerName={view.activeFreeQuestionTargetPlayerName}
          selectedTargetPlayerId={freeQuestionSelection}
          completedPlayerIds={view.completedFreeQuestionPlayerIds}
          roundNumber={view.currentRound}
          totalRounds={view.totalRounds}
          roomCode={room.code}
          isSubmittingAdvance={isSubmittingAction}
          onSelectPlayer={
            isActivePlayer && !isConversationActive && !isSubmittingAction
              ? setFreeQuestionSelection
              : undefined
          }
          onConfirm={
            isActivePlayer && !isConversationActive && !isSubmittingAction
              ? handleFreeQuestionConfirm
              : undefined
          }
          onSkip={
            isActivePlayer && !isConversationActive && !isSubmittingAction
              ? handleFreeQuestionSkip
              : undefined
          }
          onAdvanceNext={
            isActivePlayer && isConversationActive && !isSubmittingAction
              ? () => void advanceFreeQuestion()
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
