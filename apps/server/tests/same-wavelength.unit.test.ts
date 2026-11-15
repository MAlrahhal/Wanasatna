import assert from 'node:assert/strict';
import type {
  GameShellState,
  SameWavelengthAssignment,
  SameWavelengthMode,
  SameWavelengthSettings,
} from '@wanasatna/shared';
import {
  SAME_WAVELENGTH_CLUE_SECONDS,
  SAME_WAVELENGTH_GAME_ID,
  SAME_WAVELENGTH_GUESS_SECONDS,
  SAME_WAVELENGTH_INDIVIDUAL_ROUNDS,
  SAME_WAVELENGTH_TEAM_ROUNDS,
} from '@wanasatna/shared';
import {
  assignSameWavelengthPlayer,
  buildSameWavelengthLobbyView,
  clearAllSameWavelengthLobbyStatesForTests,
  getSameWavelengthLobbyState,
  setSameWavelengthLobbySettings,
  validateSameWavelengthSettings,
  validateSameWavelengthTeamRoster,
} from '../src/modules/game/experimental/same-wavelength/lobby-state.js';
import { SAME_WAVELENGTH_PROVISIONAL_SPECTRA } from '../src/modules/game/experimental/same-wavelength/provisional-content.js';
import {
  advanceSameWavelengthTurn,
  buildSameWavelengthPlayerView,
  confirmSameWavelengthPosition,
  createSameWavelengthMatch,
  expireSameWavelengthPhase,
  handleSameWavelengthPermanentLeave,
  proposeSameWavelengthPosition,
  sameWavelengthPoints,
  submitSameWavelengthClue,
  type SameWavelengthMatchState,
} from '../src/modules/game/experimental/same-wavelength/state.js';

let passed = 0;
let failed = 0;

function test(name: string, run: () => void): void {
  try {
    clearAllSameWavelengthLobbyStatesForTests();
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

function settings(mode: SameWavelengthMode): SameWavelengthSettings {
  return {
    mode,
    roundCount: mode === 'team' ? SAME_WAVELENGTH_TEAM_ROUNDS : SAME_WAVELENGTH_INDIVIDUAL_ROUNDS,
    clueSeconds: SAME_WAVELENGTH_CLUE_SECONDS,
    guessingSeconds: SAME_WAVELENGTH_GUESS_SECONDS,
  };
}

const teamAssignments: Record<string, SameWavelengthAssignment> = {
  p1: { team: 'red', role: 'clue-giver' },
  p2: { team: 'red', role: 'guesser' },
  p3: { team: 'blue', role: 'clue-giver' },
  p4: { team: 'blue', role: 'guesser' },
  p5: { team: 'red', role: 'guesser' },
};

function create(
  mode: SameWavelengthMode = 'individual',
  playerIds = mode === 'team' ? ['p1', 'p2', 'p3', 'p4', 'p5'] : ['p1', 'p2', 'p3'],
): SameWavelengthMatchState {
  return createSameWavelengthMatch({
    playerIds,
    playerNames: Object.fromEntries(playerIds.map((id) => [id, id.toUpperCase()])),
    settings: settings(mode),
    assignments: mode === 'team' ? teamAssignments : {},
    random: () => 0,
    now: 1_000,
  });
}

function shell(match: SameWavelengthMatchState, hostPlayerId = 'p1'): GameShellState {
  const ids = [...match.playerIds, 'spectator'];
  return {
    shellId: 'shell',
    roomId: 'room',
    gameId: SAME_WAVELENGTH_GAME_ID,
    phase: 'PLAYING',
    hostPlayerId,
    players: ids.map((id) => ({
      id,
      name: match.playerNames[id] ?? 'متفرج',
      isHost: id === hostPlayerId,
      isConnected: true,
      isReady: true,
      isSpectator: id === 'spectator',
    })),
    readyPlayerIds: [],
    countdownSeconds: 1,
    countdownRemainingSeconds: null,
    gameTimerSeconds: null,
    gameTimerRemainingSeconds: null,
    startedAt: new Date(0).toISOString(),
    finishedAt: null,
    updatedAt: new Date(0).toISOString(),
    matchParticipantIds: [...match.playerIds],
  };
}

function requestId(label: string): string {
  return `request-${label}`;
}

function submitClue(match: SameWavelengthMatchState, label = 'clue'): SameWavelengthMatchState {
  const result = submitSameWavelengthClue(
    match,
    match.turn.clueGiverPlayerId!,
    { turnId: match.turn.turnId, clue: 'بين الطرفين', requestId: requestId(label) },
    2_000,
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.message);
  return result.match;
}

test('provisional spectra are distinct, playable Arabic pairs', () => {
  assert.ok(SAME_WAVELENGTH_PROVISIONAL_SPECTRA.length >= 10);
  assert.equal(
    new Set(SAME_WAVELENGTH_PROVISIONAL_SPECTRA.map((entry) => entry.id)).size,
    SAME_WAVELENGTH_PROVISIONAL_SPECTRA.length,
  );
  for (const entry of SAME_WAVELENGTH_PROVISIONAL_SPECTRA) {
    assert.ok(entry.leftLabel.trim().length >= 2);
    assert.ok(entry.rightLabel.trim().length >= 2);
    assert.notEqual(entry.leftLabel, entry.rightLabel);
  }
});

test('settings accept only one exact mode and derive fixed timers and rounds', () => {
  assert.deepEqual(validateSameWavelengthSettings({ mode: 'individual' }), {
    success: true,
    data: settings('individual'),
  });
  assert.deepEqual(validateSameWavelengthSettings({ mode: 'team' }), {
    success: true,
    data: settings('team'),
  });
  assert.equal(validateSameWavelengthSettings({ mode: 'team', isAdmin: true }).success, false);
  assert.equal(validateSameWavelengthSettings({ mode: 'team', roundCount: 99 }).success, false);
  assert.equal(validateSameWavelengthSettings({ mode: 'forged' }).success, false);
});

test('scoring follows every documented closeness boundary and treats zero as a valid guess', () => {
  assert.equal(sameWavelengthPoints(0, 0), 5);
  assert.equal(sameWavelengthPoints(50, 25), 4);
  assert.equal(sameWavelengthPoints(50, 0), 3);
  assert.equal(sameWavelengthPoints(75, 0), 2);
  assert.equal(sameWavelengthPoints(99, 0), 1);
  assert.equal(sameWavelengthPoints(100, 0), 0);
  assert.equal(sameWavelengthPoints(50, null), 0);
});

test('only the current clue giver sees the secret target before reveal', () => {
  const match = create('individual');
  const clueGiver = match.turn.clueGiverPlayerId!;
  const guesser = match.playerIds.find((id) => id !== clueGiver)!;
  const clueView = buildSameWavelengthPlayerView(match, clueGiver, shell(match));
  const guesserView = buildSameWavelengthPlayerView(match, guesser, shell(match));
  const spectatorView = buildSameWavelengthPlayerView(match, 'spectator', shell(match));
  assert.equal(clueView.privateTarget, match.turn.target);
  assert.equal(guesserView.privateTarget, null);
  assert.equal(spectatorView.privateTarget, null);
  assert.equal(guesserView.revealedTarget, null);
  assert.equal(spectatorView.canPropose, false);
  assert.doesNotMatch(
    JSON.stringify(guesserView),
    new RegExp(`"privateTarget":${match.turn.target}`),
  );
});

test('forged clue, proposal, confirmation, and stale duplicate requests are rejected', () => {
  let match = create('individual');
  const clueGiver = match.turn.clueGiverPlayerId!;
  const guesser = match.playerIds.find((id) => id !== clueGiver)!;
  assert.equal(
    submitSameWavelengthClue(
      match,
      guesser,
      { turnId: match.turn.turnId, clue: 'مزور', requestId: requestId('forged-clue') },
      2_000,
    ).ok,
    false,
  );
  match = submitClue(match);
  assert.equal(
    proposeSameWavelengthPosition(
      match,
      clueGiver,
      { turnId: match.turn.turnId, position: 0, requestId: requestId('forged-guess') },
      3_000,
    ).ok,
    false,
  );
  const proposed = proposeSameWavelengthPosition(
    match,
    guesser,
    { turnId: match.turn.turnId, position: 0, requestId: requestId('proposal') },
    3_000,
  );
  assert.equal(proposed.ok, true);
  if (!proposed.ok) return;
  match = proposed.match;
  assert.equal(
    proposeSameWavelengthPosition(
      match,
      guesser,
      { turnId: match.turn.turnId, position: 1, requestId: requestId('proposal') },
      3_001,
    ).ok,
    false,
  );
  assert.equal(
    confirmSameWavelengthPosition(match, 'spectator', {
      turnId: match.turn.turnId,
      requestId: requestId('spectator-confirm'),
    }).ok,
    false,
  );
  for (const [index, position] of [Number.NaN, 1.5, -1, 101, '50'].entries()) {
    assert.equal(
      proposeSameWavelengthPosition(
        match,
        guesser,
        {
          turnId: match.turn.turnId,
          position,
          requestId: requestId(`invalid-position-${index}`),
        },
        3_100,
      ).ok,
      false,
    );
  }
});

test('changing a team proposal invalidates its confirmation until that player confirms again', () => {
  let match = submitClue(create('team'));
  const first = proposeSameWavelengthPosition(
    match,
    'p2',
    { turnId: match.turn.turnId, position: 40, requestId: requestId('first-position') },
    3_000,
  );
  assert.equal(first.ok, true);
  if (!first.ok) return;
  match = first.match;
  const confirmed = confirmSameWavelengthPosition(
    match,
    'p2',
    { turnId: match.turn.turnId, requestId: requestId('first-confirm') },
    3_100,
  );
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  match = confirmed.match;
  assert.equal(match.turn.proposals.p2?.confirmed, true);
  const revised = proposeSameWavelengthPosition(
    match,
    'p2',
    { turnId: match.turn.turnId, position: 41, requestId: requestId('revised-position') },
    3_200,
  );
  assert.equal(revised.ok, true);
  if (!revised.ok) return;
  assert.deepEqual(revised.match.turn.proposals.p2, { position: 41, confirmed: false });
});

test('team scoring requires identical separately confirmed guesses and scores once', () => {
  let match = submitClue(create('team'));
  const initialTeamView = buildSameWavelengthPlayerView(match, 'p2', shell(match));
  assert.deepEqual(
    initialTeamView.teamProposals.map(({ position, confirmed }) => ({ position, confirmed })),
    [
      { position: null, confirmed: false },
      { position: null, confirmed: false },
    ],
  );
  for (const [index, playerId] of ['p2', 'p5'].entries()) {
    const proposed = proposeSameWavelengthPosition(
      match,
      playerId,
      { turnId: match.turn.turnId, position: 0, requestId: requestId(`team-propose-${index}`) },
      3_000,
    );
    assert.equal(proposed.ok, true);
    if (!proposed.ok) return;
    match = proposed.match;
  }
  assert.equal(buildSameWavelengthPlayerView(match, 'p2', shell(match)).teamProposals.length, 2);
  assert.deepEqual(buildSameWavelengthPlayerView(match, 'p4', shell(match)).teamProposals, []);
  assert.deepEqual(
    buildSameWavelengthPlayerView(match, 'spectator', shell(match)).teamProposals,
    [],
  );

  for (const [index, playerId] of ['p2', 'p5'].entries()) {
    const confirmed = confirmSameWavelengthPosition(
      match,
      playerId,
      { turnId: match.turn.turnId, requestId: requestId(`team-confirm-${index}`) },
      4_000,
    );
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) return;
    match = confirmed.match;
  }
  assert.equal(match.turn.phase, 'turn-results');
  assert.equal(match.turn.agreedGuess, 0);
  assert.equal(match.teamScores.red, sameWavelengthPoints(match.turn.target, 0));
  assert.equal(match.teamScores.blue, 0);
  const view = buildSameWavelengthPlayerView(match, 'p2', shell(match));
  assert.equal(view.turnDistance, Math.abs(match.turn.target));
  assert.equal(view.turnCloseness, 100 - Math.abs(match.turn.target));
  assert.equal(view.turnPoints, match.teamScores.red);
  assert.deepEqual(view.roundResults, []);
  assert.equal(
    confirmSameWavelengthPosition(match, 'p5', {
      turnId: match.turn.turnId,
      requestId: requestId('team-confirm-1'),
    }).ok,
    false,
  );
});

test('team disagreement remains open until deadline then awards zero', () => {
  let match = submitClue(create('team'));
  for (const [playerId, position] of [
    ['p2', 20],
    ['p5', 21],
  ] as const) {
    const proposed = proposeSameWavelengthPosition(
      match,
      playerId,
      { turnId: match.turn.turnId, position, requestId: requestId(`p-${playerId}`) },
      3_000,
    );
    assert.equal(proposed.ok, true);
    if (!proposed.ok) return;
    match = proposed.match;
    const confirmed = confirmSameWavelengthPosition(
      match,
      playerId,
      { turnId: match.turn.turnId, requestId: requestId(`c-${playerId}`) },
      4_000,
    );
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) return;
    match = confirmed.match;
  }
  assert.equal(match.turn.phase, 'guessing');
  const expired = expireSameWavelengthPhase(
    match,
    match.turn.turnId,
    'guessing',
    match.turn.deadlineAtMs!,
  );
  assert.ok(expired);
  assert.equal(expired.turn.resultReason, 'no-consensus');
  assert.equal(expired.turn.agreedGuess, null);
  assert.equal(expired.teamScores.red, 0);
});

test('team match alternates red then blue for exactly three complete rounds', () => {
  let match = create('team');
  const order: string[] = [];
  const spectrumIds = new Set<string>();
  for (let index = 0; index < 6; index += 1) {
    order.push(`${match.currentRound}:${match.turn.activeTeam}`);
    spectrumIds.add(match.turn.spectrumId);
    const expired = expireSameWavelengthPhase(
      match,
      match.turn.turnId,
      'clue-writing',
      match.turn.deadlineAtMs!,
    );
    assert.ok(expired);
    const advanced = advanceSameWavelengthTurn(
      expired,
      expired.turn.turnId,
      100_000 + index,
      () => 0,
    );
    assert.ok(advanced);
    match = advanced;
  }
  assert.deepEqual(order, ['1:red', '1:blue', '2:red', '2:blue', '3:red', '3:blue']);
  assert.equal(spectrumIds.size, 6);
  assert.equal(match.turn.phase, 'completed');
  assert.equal(match.completedNormally, true);
  assert.equal(
    advanceSameWavelengthTurn(match, match.turn.turnId, 200_000, () => 0),
    null,
  );
});

test('individual clue rotation is shuffled once and does not repeat before every player acts', () => {
  let match = create('individual');
  const clueGivers: string[] = [];
  for (let round = 0; round < 3; round += 1) {
    clueGivers.push(match.turn.clueGiverPlayerId!);
    const expired = expireSameWavelengthPhase(
      match,
      match.turn.turnId,
      'clue-writing',
      match.turn.deadlineAtMs!,
    );
    assert.ok(expired);
    const advanced = advanceSameWavelengthTurn(
      expired,
      expired.turn.turnId,
      20_000 + round,
      () => 0,
    );
    assert.ok(advanced);
    match = advanced;
  }
  assert.equal(new Set(clueGivers).size, 3);
});

test('individual confirmations score independently without revealing another private proposal early', () => {
  let match = submitClue(create('individual'));
  const clueGiver = match.turn.clueGiverPlayerId!;
  const [first, second] = match.playerIds.filter((id) => id !== clueGiver);
  const proposed = proposeSameWavelengthPosition(
    match,
    first!,
    { turnId: match.turn.turnId, position: 0, requestId: requestId('individual-proposal') },
    3_000,
  );
  assert.equal(proposed.ok, true);
  if (!proposed.ok) return;
  match = proposed.match;
  const otherView = buildSameWavelengthPlayerView(match, second!, shell(match));
  assert.equal(otherView.ownProposal, null);
  assert.deepEqual(otherView.teamProposals, []);
  assert.doesNotMatch(JSON.stringify(otherView), /"position":0/);

  for (const [index, playerId] of [first!, second!].entries()) {
    if (playerId === second) {
      const nextProposal = proposeSameWavelengthPosition(
        match,
        playerId,
        { turnId: match.turn.turnId, position: 0, requestId: requestId(`ip-${index}`) },
        3_100,
      );
      assert.equal(nextProposal.ok, true);
      if (!nextProposal.ok) return;
      match = nextProposal.match;
    }
    const confirmed = confirmSameWavelengthPosition(
      match,
      playerId,
      { turnId: match.turn.turnId, requestId: requestId(`ic-${index}`) },
      4_000,
    );
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) return;
    match = confirmed.match;
  }
  assert.equal(match.turn.phase, 'turn-results');
  assert.equal(match.scores[first!], sameWavelengthPoints(match.turn.target, 0));
  assert.equal(match.scores[second!], sameWavelengthPoints(match.turn.target, 0));
});

test('permanent leave preserves a valid match but interrupts when a required team role is lost', () => {
  const team = create('team');
  const guesserLeft = handleSameWavelengthPermanentLeave(team, 'p5', 2_000);
  assert.equal(guesserLeft.turn.phase, 'clue-writing');
  assert.deepEqual(guesserLeft.departedPlayerIds, ['p5']);
  const clueGiverLeft = handleSameWavelengthPermanentLeave(team, 'p1', 2_000);
  assert.equal(clueGiverLeft.turn.phase, 'completed');
  assert.equal(clueGiverLeft.completedNormally, false);
});

test('team lobby requires exactly one clue giver and at least one guesser on each team', () => {
  const ids = ['p1', 'p2', 'p3', 'p4'];
  assert.equal(
    validateSameWavelengthTeamRoster({
      assignments: {
        p1: teamAssignments.p1!,
        p2: teamAssignments.p2!,
        p3: teamAssignments.p3!,
        p4: teamAssignments.p4!,
      },
      eligiblePlayerIds: ids,
    }).success,
    true,
  );
  const players = ids.map((id) => ({
    id,
    name: id,
    isHost: id === 'p1',
    isConnected: true,
    isReady: true,
    isSpectator: false,
  }));
  setSameWavelengthLobbySettings('room', settings('team'));
  for (const id of ids) {
    assert.equal(assignSameWavelengthPlayer('room', id, teamAssignments[id]).success, true);
  }
  const view = buildSameWavelengthLobbyView({
    roomId: 'room',
    players,
    selfPlayerId: 'p2',
    canAdminister: false,
  });
  assert.equal(view.canStart, true);
  assert.equal(view.canEditSettings, false);
  assert.equal(getSameWavelengthLobbyState('room').settings.mode, 'team');
  assert.equal(
    assignSameWavelengthPlayer('room', 'p2', { team: 'red', role: 'clue-giver' }).success,
    false,
  );
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
