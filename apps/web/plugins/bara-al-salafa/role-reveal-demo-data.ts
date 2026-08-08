import type { LobbyPlayer } from '@/lib/lobby/types';

export const roleRevealDemoPlayers: LobbyPlayer[] = [
  { id: 'p1', name: 'محمد', isHost: true, isSpectator: false },
  { id: 'p2', name: 'أحمد', isHost: false, isSpectator: false },
  { id: 'p3', name: 'سارة', isHost: false, isSpectator: false },
  { id: 'p4', name: 'عبدالله', isHost: false, isSpectator: false },
];

export const roleRevealDemoDefaults = {
  gameName: 'برا السالفة',
  currentRound: 1,
  totalRounds: 3,
  remainingSeconds: 45,
  roomCode: '482916',
  secretWord: 'سيارة',
  currentPlayerId: 'p2',
} as const;

export const countdownDemoDefaults = {
  gameName: 'برا السالفة',
  roundNumber: 1,
  totalRounds: 3,
  roomCode: '482916',
} as const;

export const directedQuestionsDemoDefaults = {
  gameName: 'برا السالفة',
  roundNumber: 1,
  totalRounds: 3,
  roomCode: '482916',
  askerName: 'محمد',
  targetName: 'أحمد',
  askerPlayerId: 'p1',
  targetPlayerId: 'p2',
  currentTurn: 2,
  totalTurns: 5,
  remainingSeconds: 38,
  players: roleRevealDemoPlayers,
} as const;

export const freeDiscussionDemoDefaults = {
  gameName: 'برا السالفة',
  roundNumber: 1,
  totalRounds: 3,
  roomCode: '482916',
  remainingSeconds: 90,
  currentPlayerId: 'p2',
  players: roleRevealDemoPlayers,
} as const;

export const freeDiscussionLowTimeDemoDefaults = {
  ...freeDiscussionDemoDefaults,
  remainingSeconds: 10,
} as const;

export const freeQuestionsDemoDefaults = {
  gameName: 'برا السالفة',
  roundNumber: 1,
  totalRounds: 3,
  roomCode: '482916',
  players: roleRevealDemoPlayers,
  activePlayerId: 'p2',
  activePlayerName: 'أحمد',
  currentPlayerId: 'p2',
  selectedTargetPlayerId: 'p3',
  completedPlayerIds: ['p1'],
} as const;

export const freeQuestionsWaitingDemoDefaults = {
  ...freeQuestionsDemoDefaults,
  currentPlayerId: 'p4',
  selectedTargetPlayerId: null,
} as const;

export const freeQuestionsMostCompletedDemoDefaults = {
  ...freeQuestionsDemoDefaults,
  activePlayerId: 'p2',
  currentPlayerId: 'p2',
  selectedTargetPlayerId: 'p4',
  completedPlayerIds: ['p1', 'p3'],
} as const;

export const votingDemoDefaults = {
  gameName: 'برا السالفة',
  roundNumber: 1,
  totalRounds: 3,
  roomCode: '482916',
  players: roleRevealDemoPlayers,
  currentPlayerId: 'p2',
  selectedPlayerId: 'p3',
  confirmedPlayerId: null,
  hasVoted: false,
  remainingSeconds: 30,
  submittedVotesCount: 3,
  eligibleVotersCount: 5,
} as const;

export const votingConfirmedDemoDefaults = {
  ...votingDemoDefaults,
  hasVoted: true,
  selectedPlayerId: null,
  confirmedPlayerId: 'p3',
  submittedVotesCount: 4,
} as const;

export const votingLowTimeDemoDefaults = {
  ...votingDemoDefaults,
  remainingSeconds: 5,
  submittedVotesCount: 4,
  selectedPlayerId: 'p1',
} as const;

export const votingErrorDemoDefaults = {
  ...votingDemoDefaults,
  selectedPlayerId: 'p1',
  errorMessage: 'تعذّر تسجيل صوتك. حاول مرة أخرى.',
} as const;

export const revealImpostorDemoDefaults = {
  gameName: 'برا السالفة',
  roundNumber: 1,
  totalRounds: 3,
  roomCode: '482916',
  remainingSeconds: 5,
  impostorPlayer: { id: 'p3', name: 'سارة' },
} as const;

export const revealImpostorLowTimeDemoDefaults = {
  ...revealImpostorDemoDefaults,
  remainingSeconds: 1,
} as const;

export const impostorGuessDemoOptions = [
  { id: 'car', emoji: '🚗', label: 'سيارة' },
  { id: 'bike', emoji: '🚲', label: 'دراجة' },
  { id: 'plane', emoji: '✈️', label: 'طائرة' },
  { id: 'ship', emoji: '🚢', label: 'سفينة' },
  { id: 'taxi', emoji: '🚕', label: 'تاكسي' },
  { id: 'tractor', emoji: '🚜', label: 'جرار' },
  { id: 'scooter', emoji: '🛵', label: 'سكوتر' },
  { id: 'rocket', emoji: '🚀', label: 'صاروخ' },
] as const;

export const impostorGuessDemoDefaults = {
  gameName: 'برا السالفة',
  roundNumber: 1,
  totalRounds: 3,
  roomCode: '482916',
  isImpostor: true,
  options: impostorGuessDemoOptions,
  selectedWord: 'car',
  hasSubmitted: false,
} as const;

export const impostorGuessSubmittedDemoDefaults = {
  ...impostorGuessDemoDefaults,
  selectedWord: 'car',
  hasSubmitted: true,
} as const;

export const impostorGuessWaitingDemoDefaults = {
  ...impostorGuessDemoDefaults,
  isImpostor: false,
  selectedWord: null,
  hasSubmitted: false,
} as const;

const roundResultsBasePlayers = [
  { id: 'p1', name: 'محمد', roundPoints: 100, totalPoints: 200, isImpostor: false, earnedPoints: true },
  { id: 'p2', name: 'أحمد', roundPoints: 100, totalPoints: 150, isImpostor: true, earnedPoints: true },
  { id: 'p3', name: 'سارة', roundPoints: 0, totalPoints: 100, isImpostor: false, earnedPoints: false },
  { id: 'p4', name: 'عبدالله', roundPoints: 100, totalPoints: 180, isImpostor: false, earnedPoints: true },
] as const;

const roundResultsWrongGuessPlayers = [
  { id: 'p1', name: 'محمد', roundPoints: 100, totalPoints: 200, isImpostor: false, earnedPoints: true },
  { id: 'p2', name: 'أحمد', roundPoints: 0, totalPoints: 50, isImpostor: true, earnedPoints: false },
  { id: 'p3', name: 'سارة', roundPoints: 0, totalPoints: 100, isImpostor: false, earnedPoints: false },
  { id: 'p4', name: 'عبدالله', roundPoints: 100, totalPoints: 180, isImpostor: false, earnedPoints: true },
] as const;

export const roundResultsCorrectDemoDefaults = {
  gameName: 'برا السالفة',
  roundNumber: 1,
  totalRounds: 3,
  roomCode: '482916',
  remainingSeconds: 10,
  revealedWord: 'سيارة',
  impostorPlayerId: 'p2',
  impostorPlayerName: 'أحمد',
  impostorGuessedCorrectly: true,
  roundResults: roundResultsBasePlayers,
  currentPlayerId: 'p2',
} as const;

export const roundResultsWrongDemoDefaults = {
  ...roundResultsCorrectDemoDefaults,
  impostorGuessedCorrectly: false,
  roundResults: roundResultsWrongGuessPlayers,
} as const;

export const roundResultsFinalRoundDemoDefaults = {
  ...roundResultsCorrectDemoDefaults,
  roundNumber: 3,
  totalRounds: 3,
} as const;

export const roundResultsTieDemoDefaults = {
  ...roundResultsCorrectDemoDefaults,
} as const;

const matchResultsLeaderboard = [
  { id: 'p1', name: 'محمد', totalPoints: 300, rank: 1, isFirstPlace: true, isCurrentPlayer: false },
  { id: 'p4', name: 'عبدالله', totalPoints: 280, rank: 2, isFirstPlace: false, isCurrentPlayer: false },
  { id: 'p2', name: 'أحمد', totalPoints: 250, rank: 3, isFirstPlace: false, isCurrentPlayer: false },
  { id: 'p3', name: 'سارة', totalPoints: 180, rank: 4, isFirstPlace: false, isCurrentPlayer: false },
] as const;

const matchResultsTiedLeaderboard = [
  { id: 'p1', name: 'محمد', totalPoints: 300, rank: 1, isFirstPlace: true, isCurrentPlayer: false },
  { id: 'p4', name: 'عبدالله', totalPoints: 300, rank: 1, isFirstPlace: true, isCurrentPlayer: false },
  { id: 'p2', name: 'أحمد', totalPoints: 250, rank: 3, isFirstPlace: false, isCurrentPlayer: false },
  { id: 'p3', name: 'سارة', totalPoints: 180, rank: 4, isFirstPlace: false, isCurrentPlayer: false },
] as const;

export const matchResultsSingleWinnerDemoDefaults = {
  gameName: 'برا السالفة',
  totalRounds: 3,
  playerCount: 4,
  roomCode: '482916',
  currentPlayerId: 'p2',
  leaderboard: matchResultsLeaderboard,
} as const;

export const matchResultsTiedWinnersDemoDefaults = {
  ...matchResultsSingleWinnerDemoDefaults,
  currentPlayerId: 'p2',
  leaderboard: matchResultsTiedLeaderboard,
} as const;

export const matchResultsCurrentPlayerFirstDemoDefaults = {
  ...matchResultsSingleWinnerDemoDefaults,
  currentPlayerId: 'p1',
} as const;

export const matchResultsCurrentPlayerOutsideTop3DemoDefaults = {
  ...matchResultsSingleWinnerDemoDefaults,
  currentPlayerId: 'p3',
} as const;
