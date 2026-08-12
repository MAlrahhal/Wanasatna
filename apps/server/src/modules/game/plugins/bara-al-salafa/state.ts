import type { GameShellState } from '@wanasatna/shared';
import type { BaraAlSalafaMatchState, BaraAlSalafaPlayerView } from '@wanasatna/shared';
import { getConnectedParticipantIds } from './free-questions.js';
import {
  buildLeaderboardEntries,
  buildResultsLeaderboardEntries,
  buildRoundResultEntries,
} from './scoring.js';

const IMPOSTOR_MESSAGE = 'أنت برا السالفة';
const FREE_QUESTIONS_ACTIVE_INSTRUCTION = 'اختر لاعباً لتسأله';
const VOTING_INSTRUCTION = 'صوّت لمين تتوقع أنه برا السالفة';
const IMPOSTOR_GUESS_INSTRUCTION = 'خمّن الكلمة';
const IMPOSTOR_GUESS_SPECTATOR_INSTRUCTION = 'برا السالفة يحاول تخمين الكلمة...';

const PHASE_LABELS = {
  description: 'كشف الدور',
  'directed-questions': 'أسئلة موجهة',
  'free-questions': 'أسئلة حرة',
  voting: 'مرحلة التصويت',
  'reveal-impostor': 'كشف برا السالفة',
  'impostor-guess': 'تخمين برا السالفة',
  'impostor-guess-result': 'نتيجة التخمين',
  'round-results': 'نتيجة الجولة',
  'match-completed': 'انتهت المباراة',
} as const;

function buildRoundPhaseLabel(match: BaraAlSalafaMatchState): string {
  const phaseLabel = PHASE_LABELS[match.round.gamePhase];
  return `${phaseLabel} — الجولة ${match.currentRound}/${match.totalRounds}`;
}

function buildDirectedQuestionsView(
  match: BaraAlSalafaMatchState,
  playerId: string,
): Pick<
  BaraAlSalafaPlayerView,
  | 'instruction'
  | 'currentSpeakerName'
  | 'directedQuestionAskerPlayerId'
  | 'directedQuestionAskerName'
  | 'directedQuestionTargetPlayerId'
  | 'directedQuestionTargetName'
  | 'directedQuestionCurrentTurn'
  | 'directedQuestionTotalTurns'
  | 'isDirectedQuestionActiveAsker'
> {
  const currentPair = match.round.directedQuestionPairs[match.round.currentSpeakerIndex];
  const totalTurns = match.round.directedQuestionPairs.length;

  if (!currentPair) {
    return {
      instruction: null,
      currentSpeakerName: null,
      directedQuestionAskerPlayerId: null,
      directedQuestionAskerName: null,
      directedQuestionTargetPlayerId: null,
      directedQuestionTargetName: null,
      directedQuestionCurrentTurn: 0,
      directedQuestionTotalTurns: totalTurns,
      isDirectedQuestionActiveAsker: false,
    };
  }

  const askerName = match.playerNames[currentPair.askerPlayerId] ?? 'لاعب';
  const targetName = match.playerNames[currentPair.targetPlayerId] ?? 'لاعب';

  return {
    instruction: `${askerName} اسأل ${targetName}`,
    currentSpeakerName: askerName,
    directedQuestionAskerPlayerId: currentPair.askerPlayerId,
    directedQuestionAskerName: askerName,
    directedQuestionTargetPlayerId: currentPair.targetPlayerId,
    directedQuestionTargetName: targetName,
    directedQuestionCurrentTurn: match.round.currentSpeakerIndex + 1,
    directedQuestionTotalTurns: totalTurns,
    isDirectedQuestionActiveAsker: currentPair.askerPlayerId === playerId,
  };
}

function buildDescriptionView(
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  playerId: string,
): Pick<
  BaraAlSalafaPlayerView,
  'hasAcknowledgedRole' | 'roleAcknowledgementCount' | 'eligibleRoleAcknowledgementCount'
> {
  const connectedIds = getConnectedParticipantIds(shell, match);

  return {
    hasAcknowledgedRole: match.round.roleUnderstoodPlayerIds.includes(playerId),
    roleAcknowledgementCount: match.round.roleUnderstoodPlayerIds.length,
    eligibleRoleAcknowledgementCount: connectedIds.length,
  };
}

function buildRoundResultsInteractionView(
  _match: BaraAlSalafaMatchState,
  shell: GameShellState,
  playerId: string,
): Pick<
  BaraAlSalafaPlayerView,
  | 'isHost'
  | 'canContinueFromRoundResults'
  | 'roundResultsContinueLabel'
  | 'roundResultsWaitingMessage'
> {
  const isHost = shell.hostPlayerId === playerId;

  return {
    isHost,
    canContinueFromRoundResults: isHost,
    roundResultsContinueLabel: isHost ? 'التالي الآن' : null,
    roundResultsWaitingMessage: 'الجولة التالية تبدأ تلقائياً...',
  };
}

function buildFreeQuestionsView(
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  playerId: string,
): Pick<
  BaraAlSalafaPlayerView,
  | 'instruction'
  | 'isFreeQuestionActivePlayer'
  | 'selectablePlayers'
  | 'activeFreeQuestionPlayerId'
  | 'activeFreeQuestionPlayerName'
  | 'activeFreeQuestionTargetPlayerId'
  | 'activeFreeQuestionTargetPlayerName'
  | 'completedFreeQuestionPlayerIds'
> {
  const activePlayerId = match.round.activeFreeQuestionPlayerId;
  const activePlayerName = activePlayerId
    ? (match.playerNames[activePlayerId] ?? 'لاعب')
    : null;
  const targetPlayerId = match.round.pendingFreeQuestionTargetPlayerId;
  const targetPlayerName = targetPlayerId
    ? (match.playerNames[targetPlayerId] ?? 'لاعب')
    : null;
  const isActivePlayer = activePlayerId === playerId;
  const isConversationActive = targetPlayerId !== null;

  const selectablePlayers = isConversationActive
    ? []
    : getConnectedParticipantIds(shell, match)
        .filter((participantId) => participantId !== playerId)
        .map((participantId) => ({
          id: participantId,
          name: match.playerNames[participantId] ?? 'لاعب',
        }));

  if (isConversationActive && activePlayerName && targetPlayerName) {
    const conversationInstruction = `${activePlayerName} يسأل ${targetPlayerName}`;

    if (isActivePlayer) {
      return {
        instruction: conversationInstruction,
        isFreeQuestionActivePlayer: true,
        selectablePlayers: [],
        activeFreeQuestionPlayerId: activePlayerId,
        activeFreeQuestionPlayerName: activePlayerName,
        activeFreeQuestionTargetPlayerId: targetPlayerId,
        activeFreeQuestionTargetPlayerName: targetPlayerName,
        completedFreeQuestionPlayerIds: match.round.completedFreeQuestionTurns,
      };
    }

    return {
      instruction: conversationInstruction,
      isFreeQuestionActivePlayer: false,
      selectablePlayers: [],
      activeFreeQuestionPlayerId: activePlayerId,
      activeFreeQuestionPlayerName: activePlayerName,
      activeFreeQuestionTargetPlayerId: targetPlayerId,
      activeFreeQuestionTargetPlayerName: targetPlayerName,
      completedFreeQuestionPlayerIds: match.round.completedFreeQuestionTurns,
    };
  }

  if (isActivePlayer) {
    return {
      instruction: FREE_QUESTIONS_ACTIVE_INSTRUCTION,
      isFreeQuestionActivePlayer: true,
      selectablePlayers,
      activeFreeQuestionPlayerId: activePlayerId,
      activeFreeQuestionPlayerName: activePlayerName,
      activeFreeQuestionTargetPlayerId: null,
      activeFreeQuestionTargetPlayerName: null,
      completedFreeQuestionPlayerIds: match.round.completedFreeQuestionTurns,
    };
  }

  return {
    instruction: activePlayerName ? `بانتظار اختيار ${activePlayerName}` : null,
    isFreeQuestionActivePlayer: false,
    selectablePlayers: [],
    activeFreeQuestionPlayerId: activePlayerId,
    activeFreeQuestionPlayerName: activePlayerName,
    activeFreeQuestionTargetPlayerId: null,
    activeFreeQuestionTargetPlayerName: null,
    completedFreeQuestionPlayerIds: match.round.completedFreeQuestionTurns,
  };
}

const EMPTY_INTERACTION_VIEW: Pick<
  BaraAlSalafaPlayerView,
  | 'directedQuestionAskerPlayerId'
  | 'directedQuestionAskerName'
  | 'directedQuestionTargetPlayerId'
  | 'directedQuestionTargetName'
  | 'directedQuestionCurrentTurn'
  | 'directedQuestionTotalTurns'
  | 'isDirectedQuestionActiveAsker'
  | 'hasAcknowledgedRole'
  | 'roleAcknowledgementCount'
  | 'eligibleRoleAcknowledgementCount'
  | 'isFreeQuestionActivePlayer'
  | 'selectablePlayers'
  | 'activeFreeQuestionPlayerId'
  | 'activeFreeQuestionPlayerName'
  | 'activeFreeQuestionTargetPlayerId'
  | 'activeFreeQuestionTargetPlayerName'
  | 'completedFreeQuestionPlayerIds'
  | 'hasVoted'
  | 'votablePlayers'
  | 'submittedVotesCount'
  | 'eligibleVotersCount'
  | 'confirmedVoteTargetPlayerId'
  | 'revealedImpostorPlayerId'
  | 'revealedImpostorName'
  | 'isImpostorGuessActivePlayer'
  | 'impostorGuessOptions'
  | 'hasSubmittedImpostorGuess'
  | 'revealedWord'
  | 'guessResultMessage'
  | 'leaderboard'
  | 'roundResults'
  | 'resultsLeaderboard'
  | 'impostorGuessedCorrectly'
  | 'matchPlayerCount'
  | 'isFinalResults'
  | 'isHost'
  | 'canContinueFromRoundResults'
  | 'roundResultsContinueLabel'
  | 'roundResultsWaitingMessage'
  | 'isMatchSpectator'
> = {
  directedQuestionAskerPlayerId: null,
  directedQuestionAskerName: null,
  directedQuestionTargetPlayerId: null,
  directedQuestionTargetName: null,
  directedQuestionCurrentTurn: 0,
  directedQuestionTotalTurns: 0,
  isDirectedQuestionActiveAsker: false,
  hasAcknowledgedRole: false,
  roleAcknowledgementCount: 0,
  eligibleRoleAcknowledgementCount: 0,
  isFreeQuestionActivePlayer: false,
  selectablePlayers: [],
  activeFreeQuestionPlayerId: null,
  activeFreeQuestionPlayerName: null,
  activeFreeQuestionTargetPlayerId: null,
  activeFreeQuestionTargetPlayerName: null,
  completedFreeQuestionPlayerIds: [],
  hasVoted: false,
  votablePlayers: [],
  submittedVotesCount: 0,
  eligibleVotersCount: 0,
  confirmedVoteTargetPlayerId: null,
  revealedImpostorPlayerId: null,
  revealedImpostorName: null,
  isImpostorGuessActivePlayer: false,
  impostorGuessOptions: [],
  hasSubmittedImpostorGuess: false,
  revealedWord: null,
  guessResultMessage: null,
  leaderboard: [],
  roundResults: [],
  resultsLeaderboard: [],
  impostorGuessedCorrectly: null,
  matchPlayerCount: 0,
  isFinalResults: false,
  isHost: false,
  canContinueFromRoundResults: false,
  roundResultsContinueLabel: null,
  roundResultsWaitingMessage: null,
  isMatchSpectator: false,
};

function buildVotingView(
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  playerId: string,
): Pick<
  BaraAlSalafaPlayerView,
  | 'instruction'
  | 'hasVoted'
  | 'votablePlayers'
  | 'submittedVotesCount'
  | 'eligibleVotersCount'
  | 'confirmedVoteTargetPlayerId'
> {
  const connectedParticipantIds = getConnectedParticipantIds(shell, match);
  const hasVoted = match.round.submittedVoterIds.includes(playerId);
  const confirmedVoteTargetPlayerId = hasVoted ? (match.round.votes[playerId] ?? null) : null;

  const votablePlayers = hasVoted
    ? []
    : connectedParticipantIds
        .filter((participantId) => participantId !== playerId)
        .map((participantId) => ({
          id: participantId,
          name: match.playerNames[participantId] ?? 'لاعب',
        }));

  return {
    instruction: VOTING_INSTRUCTION,
    hasVoted,
    votablePlayers,
    submittedVotesCount: match.round.submittedVoterIds.length,
    eligibleVotersCount: connectedParticipantIds.length,
    confirmedVoteTargetPlayerId,
  };
}

export function buildBaraAlSalafaSpectatorView(
  match: BaraAlSalafaMatchState,
): BaraAlSalafaPlayerView {
  return {
    role: 'player',
    displayText: '',
    gamePhase: match.round.gamePhase,
    phaseLabel: 'الجولة جارية',
    phaseRemainingSeconds: match.round.phaseRemainingSeconds,
    categoryName: match.round.categoryName,
    instruction: 'أنت حالياً مشاهد، وبتقدر تلعب في المباراة القادمة.',
    currentSpeakerName: null,
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    ...EMPTY_INTERACTION_VIEW,
    isMatchSpectator: true,
    leaderboard: buildLeaderboardEntries(match),
  };
}

export function buildBaraAlSalafaPlayerView(
  match: BaraAlSalafaMatchState,
  playerId: string,
  shell: GameShellState,
): BaraAlSalafaPlayerView {
  const round = match.round;
  const roleView =
    playerId === round.impostorPlayerId
      ? { role: 'impostor' as const, displayText: IMPOSTOR_MESSAGE }
      : { role: 'player' as const, displayText: round.word };

  const baseView = {
    ...roleView,
    gamePhase: round.gamePhase,
    phaseLabel: buildRoundPhaseLabel(match),
    phaseRemainingSeconds: round.phaseRemainingSeconds,
    categoryName: round.categoryName,
    currentRound: match.currentRound,
    totalRounds: match.totalRounds,
    matchStatus: match.matchStatus,
    ...EMPTY_INTERACTION_VIEW,
  };

  if (round.gamePhase === 'description') {
    return {
      ...baseView,
      instruction:
        roleView.role === 'impostor'
          ? 'اعرف دورك، ثم اضغط فهمت.'
          : 'احفظ الكلمة جيداً، ثم اضغط فهمت.',
      currentSpeakerName: null,
      ...buildDescriptionView(match, shell, playerId),
    };
  }

  if (round.gamePhase === 'directed-questions') {
    return {
      ...baseView,
      ...buildDirectedQuestionsView(match, playerId),
    };
  }

  if (round.gamePhase === 'free-questions') {
    return {
      ...baseView,
      currentSpeakerName: null,
      ...buildFreeQuestionsView(match, shell, playerId),
    };
  }

  if (round.gamePhase === 'voting') {
    return {
      ...baseView,
      currentSpeakerName: null,
      ...buildVotingView(match, shell, playerId),
    };
  }

  if (round.gamePhase === 'reveal-impostor') {
    const impostorName = match.playerNames[round.impostorPlayerId] ?? 'لاعب';

    return {
      ...baseView,
      role: 'player',
      displayText: '',
      instruction: null,
      currentSpeakerName: null,
      revealedImpostorPlayerId: round.impostorPlayerId,
      revealedImpostorName: impostorName,
      revealedWord: null,
    };
  }

  if (round.gamePhase === 'impostor-guess') {
    const isImpostor = playerId === round.impostorPlayerId;
    const hasSubmittedImpostorGuess = round.selectedWord !== null;

    if (isImpostor) {
      return {
        ...baseView,
        role: 'impostor',
        displayText: '',
        instruction: hasSubmittedImpostorGuess ? null : IMPOSTOR_GUESS_INSTRUCTION,
        currentSpeakerName: null,
        isImpostorGuessActivePlayer: true,
        impostorGuessOptions: hasSubmittedImpostorGuess ? [] : round.impostorGuessOptions,
        hasSubmittedImpostorGuess,
        revealedImpostorPlayerId: round.impostorPlayerId,
        revealedImpostorName: match.playerNames[round.impostorPlayerId] ?? 'لاعب',
        revealedWord: null,
      };
    }

    return {
      ...baseView,
      role: 'player',
      // Normals keep knowing the word privately via displayText; never expose via revealedWord yet.
      displayText: round.word,
      instruction: IMPOSTOR_GUESS_SPECTATOR_INSTRUCTION,
      currentSpeakerName: null,
      isImpostorGuessActivePlayer: false,
      impostorGuessOptions: [],
      hasSubmittedImpostorGuess: false,
      revealedImpostorPlayerId: round.impostorPlayerId,
      revealedImpostorName: match.playerNames[round.impostorPlayerId] ?? 'لاعب',
      revealedWord: null,
    };
  }

  if (round.gamePhase === 'impostor-guess-result') {
    const impostorName = match.playerNames[round.impostorPlayerId] ?? 'لاعب';
    const guessResultMessage =
      round.guessedCorrectly === true ? 'إجابة صحيحة!' : 'إجابة خاطئة!';

    return {
      ...baseView,
      role: 'player',
      displayText: '',
      instruction: null,
      currentSpeakerName: null,
      revealedImpostorPlayerId: round.impostorPlayerId,
      revealedImpostorName: impostorName,
      revealedWord: round.word,
      impostorGuessedCorrectly: round.guessedCorrectly,
      guessResultMessage,
    };
  }

  if (round.gamePhase === 'round-results') {
    const impostorName = match.playerNames[round.impostorPlayerId] ?? 'لاعب';

    return {
      ...baseView,
      role: 'player',
      displayText: '',
      instruction: null,
      currentSpeakerName: null,
      revealedImpostorPlayerId: round.impostorPlayerId,
      revealedImpostorName: impostorName,
      revealedWord: round.word,
      impostorGuessedCorrectly: round.guessedCorrectly,
      roundResults: buildRoundResultEntries(match),
      resultsLeaderboard: buildResultsLeaderboardEntries(match),
      leaderboard: buildLeaderboardEntries(match),
      isFinalResults: false,
      ...buildRoundResultsInteractionView(match, shell, playerId),
    };
  }

  if (round.gamePhase === 'match-completed') {
    const isHost = shell.hostPlayerId === playerId;

    return {
      ...baseView,
      role: 'player',
      displayText: '',
      instruction: null,
      currentSpeakerName: null,
      revealedWord: null,
      revealedImpostorName: null,
      impostorGuessedCorrectly: null,
      roundResults: [],
      resultsLeaderboard: buildResultsLeaderboardEntries(match),
      leaderboard: buildLeaderboardEntries(match),
      matchPlayerCount: match.playerIds.length,
      isFinalResults: true,
      isHost,
      canContinueFromRoundResults: isHost,
      roundResultsContinueLabel: isHost ? 'العودة إلى اللوبي' : null,
      roundResultsWaitingMessage: 'العودة إلى اللوبي تلقائياً خلال ثوانٍ...',
    };
  }

  return {
    ...baseView,
    instruction: 'انتهت المباراة.',
    currentSpeakerName: null,
  };
}

export { createMatchState } from './round-state.js';
