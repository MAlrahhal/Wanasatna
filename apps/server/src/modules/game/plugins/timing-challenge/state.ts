import type {
  GameShellPlayer,
  GameShellState,
  TimingChallengeMatchState,
  TimingChallengePlayerRoundState,
  TimingChallengePlayerView,
  TimingChallengeRoundState,
  TimingChallengeSettings,
} from '@wanasatna/shared';
import {
  TIMING_CHALLENGE_DEFAULT_ROUNDS,
  buildRoundResultsContinueCopy,
  MATCH_COMPLETED_RETURN_TO_LOBBY_LABEL,
  MATCH_COMPLETED_WAITING_MESSAGE,
} from '@wanasatna/shared';
import { randomUUID } from 'node:crypto';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { remainingSecondsFromDeadline, timedPhaseClock } from '../../runtime/phase-deadline.js';
import {
  buildLeaderboardEntries,
  buildResultsLeaderboardEntries,
  buildRoundResultEntries,
} from './scoring.js';
import { pickTargetMs } from './settings.js';

const PHASE_LABELS = {
  ready: 'استعد',
  'hidden-timing': 'التوقيت جارٍ',
  guessing: 'تخمين الوقت',
  'stop-timer': 'أوقف الوقت',
  'round-results': 'نتيجة الجولة',
  'match-completed': 'انتهت المباراة',
} as const;

export function createInitialScores(playerIds: string[]): Record<string, number> {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, 0]));
}

export function withRound(
  match: TimingChallengeMatchState,
  round: TimingChallengeRoundState,
): TimingChallengeMatchState {
  return { ...match, round };
}

export function createEmptyPlayerState(): TimingChallengePlayerRoundState {
  return {
    ready: false,
    guessMs: null,
    timerStartedAtMs: null,
    stoppedAtMs: null,
    elapsedMs: null,
    errorMs: null,
    signedDeltaMs: null,
  };
}

export function createRoundState(
  playerIds: string[],
  settings: TimingChallengeSettings,
): TimingChallengeRoundState {
  return {
    roundId: randomUUID(),
    gamePhase: 'ready',
    ...timedPhaseClock(timedPhaseDurations.timingChallengeReady()),
    targetMs: pickTargetMs(settings),
    hiddenStartedAtMs: null,
    hiddenEndsAtMs: null,
    playerStates: Object.fromEntries(playerIds.map((playerId) => [playerId, createEmptyPlayerState()])),
  };
}

export function createMatchState(
  players: GameShellPlayer[],
  settings: TimingChallengeSettings,
): TimingChallengeMatchState {
  if (players.length === 0) {
    throw new Error('No players available for Timing Challenge match.');
  }

  const playerIds = players.map((player) => player.id);
  const lockedSettings: TimingChallengeSettings = {
    ...settings,
    rounds: TIMING_CHALLENGE_DEFAULT_ROUNDS,
  };

  return {
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: TIMING_CHALLENGE_DEFAULT_ROUNDS,
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
    settings: lockedSettings,
    round: createRoundState(playerIds, lockedSettings),
  };
}

export function getConnectedParticipantIds(
  match: TimingChallengeMatchState,
  shell: GameShellState,
): string[] {
  const connected = new Set(
    shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return match.playerIds.filter((playerId) => connected.has(playerId));
}

export function allConnectedReady(match: TimingChallengeMatchState, shell: GameShellState): boolean {
  const connectedIds = getConnectedParticipantIds(match, shell);
  return (
    connectedIds.length > 0 &&
    connectedIds.every((playerId) => match.round.playerStates[playerId]?.ready === true)
  );
}

export function allConnectedGuessed(match: TimingChallengeMatchState, shell: GameShellState): boolean {
  const connectedIds = getConnectedParticipantIds(match, shell);
  return (
    connectedIds.length > 0 &&
    connectedIds.every((playerId) => match.round.playerStates[playerId]?.guessMs !== null)
  );
}

export function allConnectedStopped(match: TimingChallengeMatchState, shell: GameShellState): boolean {
  const connectedIds = getConnectedParticipantIds(match, shell);
  return (
    connectedIds.length > 0 &&
    connectedIds.every((playerId) => match.round.playerStates[playerId]?.elapsedMs !== null)
  );
}

function buildPeers(
  match: TimingChallengeMatchState,
): TimingChallengePlayerView['peers'] {
  const phase = match.round.gamePhase;
  const mode = match.settings.mode;

  return match.playerIds.map((peerId) => {
    const state = match.round.playerStates[peerId] ?? createEmptyPlayerState();
    let status: TimingChallengePlayerView['peers'][number]['status'] = 'waiting';

    if (phase === 'ready') {
      status = state.ready ? 'ready' : 'waiting';
    } else if (mode === 'guess-time') {
      status = state.guessMs !== null ? 'done' : 'waiting';
    } else if (state.elapsedMs !== null) {
      status = 'done';
    } else if (state.timerStartedAtMs !== null) {
      status = 'running';
    }

    return {
      playerId: peerId,
      name: match.playerNames[peerId] ?? 'لاعب',
      status,
    };
  });
}

function visibleTimingClock(match: TimingChallengeMatchState): {
  phaseRemainingSeconds: number;
  deadlineAtMs: number | null;
} {
  const phase = match.round.gamePhase;

  if (phase === 'hidden-timing') {
    return { phaseRemainingSeconds: 0, deadlineAtMs: null };
  }

  return {
    phaseRemainingSeconds: match.round.deadlineAtMs
      ? remainingSecondsFromDeadline(match.round.deadlineAtMs)
      : match.round.phaseRemainingSeconds,
    deadlineAtMs: match.round.deadlineAtMs,
  };
}

export function buildTimingChallengeSpectatorView(
  match: TimingChallengeMatchState,
): TimingChallengePlayerView {
  const phase = match.round.gamePhase;
  const mode = match.settings.mode;
  const revealed = phase === 'round-results' || phase === 'match-completed';
  const publicTargetMs =
    mode === 'guess-time' ? (revealed ? match.round.targetMs : null) : match.round.targetMs;

  return {
    gamePhase: phase,
    phaseLabel: 'الجولة جارية',
    ...visibleTimingClock(match),
    mode,
    roundId: match.round.roundId,
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    targetMs: publicTargetMs,
    selfReady: false,
    selfGuessMs: null,
    selfSubmitted: false,
    selfTimerRunning: false,
    selfElapsedMs: null,
    selfErrorMs: null,
    selfSignedDeltaMs: null,
    canReady: false,
    canGuess: false,
    canStartTimer: false,
    canStopTimer: false,
    peers: buildPeers(match),
    roundResults: revealed ? buildRoundResultEntries(match) : [],
    leaderboard: [],
    resultsLeaderboard: revealed ? buildResultsLeaderboardEntries(match) : [],
    isHost: false,
    canContinueFromRoundResults: false,
    roundResultsContinueLabel: null,
    roundResultsWaitingMessage: null,
    isMatchSpectator: true,
  };
}

export function buildTimingChallengePlayerView(
  match: TimingChallengeMatchState,
  playerId: string,
  shell: GameShellState,
): TimingChallengePlayerView {
  if (!match.playerIds.includes(playerId)) {
    return buildTimingChallengeSpectatorView(match);
  }

  const self = match.round.playerStates[playerId] ?? createEmptyPlayerState();
  const phase = match.round.gamePhase;
  const mode = match.settings.mode;
  const revealed = phase === 'round-results' || phase === 'match-completed';
  const publicTargetMs =
    mode === 'guess-time' ? (revealed ? match.round.targetMs : null) : match.round.targetMs;

  const base: TimingChallengePlayerView = {
    gamePhase: phase,
    phaseLabel: `${PHASE_LABELS[phase]} — الجولة ${match.currentRound}/${match.totalRounds}`,
    ...visibleTimingClock(match),
    mode,
    roundId: match.round.roundId,
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    targetMs: publicTargetMs,
    selfReady: self.ready,
    selfGuessMs: self.guessMs,
    selfSubmitted: mode === 'guess-time' ? self.guessMs !== null : self.elapsedMs !== null,
    selfTimerRunning:
      mode === 'stop-timer' && self.timerStartedAtMs !== null && self.elapsedMs === null,
    selfElapsedMs: self.elapsedMs,
    selfErrorMs: self.errorMs,
    selfSignedDeltaMs: self.signedDeltaMs,
    canReady: phase === 'ready' && !self.ready,
    canGuess: mode === 'guess-time' && phase === 'guessing' && self.guessMs === null,
    canStartTimer:
      mode === 'stop-timer' && phase === 'stop-timer' && self.timerStartedAtMs === null,
    canStopTimer:
      mode === 'stop-timer' &&
      phase === 'stop-timer' &&
      self.timerStartedAtMs !== null &&
      self.elapsedMs === null,
    peers: buildPeers(match),
    roundResults: revealed ? buildRoundResultEntries(match) : [],
    leaderboard: buildLeaderboardEntries(match),
    resultsLeaderboard: revealed ? buildResultsLeaderboardEntries(match) : [],
    isHost: shell.hostPlayerId === playerId,
    canContinueFromRoundResults: false,
    roundResultsContinueLabel: null,
    roundResultsWaitingMessage: null,
    isMatchSpectator: false,
  };

  if (phase === 'round-results') {
    return {
      ...base,
      ...buildRoundResultsContinueCopy({
        isFinalRound: match.currentRound >= match.totalRounds,
        isHost: shell.hostPlayerId === playerId,
      }),
    };
  }

  if (phase === 'match-completed') {
    const isHost = shell.hostPlayerId === playerId;
    return {
      ...base,
      isHost,
      canContinueFromRoundResults: isHost,
      roundResultsContinueLabel: isHost ? MATCH_COMPLETED_RETURN_TO_LOBBY_LABEL : null,
      roundResultsWaitingMessage: MATCH_COMPLETED_WAITING_MESSAGE,
    };
  }

  return base;
}
