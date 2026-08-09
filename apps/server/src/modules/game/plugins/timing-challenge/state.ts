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
  const targetMs = pickTargetMs(settings);

  return {
    gamePhase: 'ready',
    phaseRemainingSeconds: 0,
    targetMs,
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

  return {
    playerIds,
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: settings.rounds,
    scores: createInitialScores(playerIds),
    matchStatus: 'in-progress',
    settings,
    round: createRoundState(playerIds, settings),
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

function allConnectedReady(match: TimingChallengeMatchState, shell: GameShellState): boolean {
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

export { allConnectedReady };

function buildRoundResultsInteractionView(
  match: TimingChallengeMatchState,
  shell: GameShellState,
  playerId: string,
): Pick<
  TimingChallengePlayerView,
  | 'isHost'
  | 'canContinueFromRoundResults'
  | 'roundResultsContinueLabel'
  | 'roundResultsWaitingMessage'
> {
  const isHost = shell.hostPlayerId === playerId;
  const isFinalRound = match.currentRound >= match.totalRounds;

  return {
    isHost,
    canContinueFromRoundResults: isHost && match.round.gamePhase === 'round-results',
    roundResultsContinueLabel: isHost
      ? isFinalRound
        ? 'عرض النتائج النهائية'
        : 'بدء الجولة التالية'
      : null,
    roundResultsWaitingMessage: isHost
      ? null
      : 'بانتظار المضيف للمتابعة...',
  };
}

export function buildTimingChallengePlayerView(
  match: TimingChallengeMatchState,
  playerId: string,
  shell: GameShellState,
): TimingChallengePlayerView {
  const self = match.round.playerStates[playerId] ?? createEmptyPlayerState();
  const phase = match.round.gamePhase;
  const mode = match.settings.mode;
  const isParticipant = match.playerIds.includes(playerId);
  const revealed = phase === 'round-results' || phase === 'match-completed';

  // Mode A: hide target until reveal. Mode B: public from ready onward.
  const publicTargetMs =
    mode === 'guess-time' ? (revealed ? match.round.targetMs : null) : match.round.targetMs;

  const peers = match.playerIds.map((peerId) => {
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

  return {
    gamePhase: phase,
    phaseLabel: `${PHASE_LABELS[phase]} — الجولة ${match.currentRound}/${match.totalRounds}`,
    // Never leak Mode A remaining hidden duration through the countdown field.
    phaseRemainingSeconds: phase === 'hidden-timing' ? 0 : match.round.phaseRemainingSeconds,
    mode,
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    targetMs: publicTargetMs,
    selfReady: self.ready,
    selfGuessMs: self.guessMs,
    selfSubmitted:
      mode === 'guess-time' ? self.guessMs !== null : self.elapsedMs !== null,
    selfTimerRunning:
      mode === 'stop-timer' &&
      self.timerStartedAtMs !== null &&
      self.elapsedMs === null,
    selfElapsedMs: self.elapsedMs,
    selfErrorMs: self.errorMs,
    selfSignedDeltaMs: self.signedDeltaMs,
    canReady: isParticipant && phase === 'ready' && !self.ready,
    canGuess:
      isParticipant &&
      mode === 'guess-time' &&
      phase === 'guessing' &&
      self.guessMs === null,
    canStartTimer:
      isParticipant &&
      mode === 'stop-timer' &&
      phase === 'stop-timer' &&
      self.timerStartedAtMs === null,
    canStopTimer:
      isParticipant &&
      mode === 'stop-timer' &&
      phase === 'stop-timer' &&
      self.timerStartedAtMs !== null &&
      self.elapsedMs === null,
    peers,
    roundResults: revealed ? buildRoundResultEntries(match) : [],
    leaderboard: buildLeaderboardEntries(match),
    resultsLeaderboard: buildResultsLeaderboardEntries(match),
    ...buildRoundResultsInteractionView(match, shell, playerId),
  };
}
