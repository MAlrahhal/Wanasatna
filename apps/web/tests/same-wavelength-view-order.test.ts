import assert from 'node:assert/strict';
import type { SameWavelengthPlayerView } from '@wanasatna/shared';
import { shouldAcceptSameWavelengthView } from '../plugins/same-wavelength/view-order';

function view(overrides: Partial<SameWavelengthPlayerView> = {}): SameWavelengthPlayerView {
  return {
    gameId: 'same-wavelength',
    selfPlayerId: 'p1',
    matchId: 'match-1',
    turnId: 'turn-1',
    mode: 'individual',
    phase: 'guessing',
    settings: { mode: 'individual', roundCount: 5, clueSeconds: 40, guessingSeconds: 40 },
    currentRound: 1,
    totalRounds: 5,
    activeTeam: null,
    teamTurnNumber: null,
    leftLabel: 'أ',
    rightLabel: 'ب',
    clueGiverPlayerId: 'p2',
    clueGiverName: 'لاعب',
    selfAssignment: null,
    isSpectator: false,
    isClueGiver: false,
    canSubmitClue: false,
    canPropose: true,
    canConfirm: false,
    canAdvance: false,
    clue: 'تلميح',
    privateTarget: null,
    revealedTarget: null,
    ownProposal: null,
    ownConfirmed: false,
    teamProposals: [],
    agreedGuess: null,
    turnDistance: null,
    turnCloseness: null,
    turnPoints: null,
    deadlineAtMs: 50_000,
    remainingSeconds: 40,
    roundResults: [],
    leaderboard: [],
    teamSummaries: [],
    completedNormally: null,
    resultReason: null,
    ...overrides,
  };
}

assert.equal(
  shouldAcceptSameWavelengthView(view({ phase: 'turn-results' }), view({ phase: 'guessing' })),
  false,
  'a stale ACK cannot move the current turn back to guessing',
);
assert.equal(
  shouldAcceptSameWavelengthView(view(), view({ deadlineAtMs: 60_000 })),
  false,
  'a stale same-phase deadline cannot extend the countdown',
);
assert.equal(
  shouldAcceptSameWavelengthView(
    view({ ownProposal: 0, ownConfirmed: true }),
    view({ ownProposal: 0, ownConfirmed: false }),
  ),
  false,
  'confirmation cannot be undone by an older view',
);
assert.equal(
  shouldAcceptSameWavelengthView(
    view({ mode: 'team', ownProposal: 40, ownConfirmed: true }),
    view({ mode: 'team', ownProposal: 41, ownConfirmed: false }),
  ),
  true,
  'a team proposal revision can legitimately clear confirmation',
);
assert.equal(
  shouldAcceptSameWavelengthView(
    view({ phase: 'turn-results' }),
    view({ turnId: 'turn-2', phase: 'clue-writing', currentRound: 2, deadlineAtMs: 90_000 }),
  ),
  true,
  'a later round can install its new authoritative deadline',
);
assert.equal(
  shouldAcceptSameWavelengthView(view(), view({ matchId: 'match-2', turnId: 'turn-new' })),
  true,
  'a new match is accepted',
);

console.log('6 passed, 0 failed');
