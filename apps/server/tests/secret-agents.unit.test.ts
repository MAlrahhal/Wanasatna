import assert from 'node:assert/strict';
import type { GameShellState, SecretAgentsAssignment } from '@wanasatna/shared';
import { SECRET_AGENTS_DEFAULT_SETTINGS, SECRET_AGENTS_GAME_ID } from '@wanasatna/shared';
import {
  assignSecretAgentsLobbyPlayer,
  clearAllSecretAgentsLobbyStatesForTests,
  getSecretAgentsLobbyState,
  randomizeSecretAgentsLobbyAssignments,
  updateSecretAgentsLobbySettings,
  validateSecretAgentsRoster,
} from '../src/modules/game/experimental/secret-agents/lobby-state.js';
import {
  addSecretAgentsMidMatchPlayer,
  buildSecretAgentsPlayerView,
  confirmSecretAgentsCard,
  countSecretAgentsByType,
  createSecretAgentsBoard,
  createSecretAgentsMatch,
  expireSecretAgentsPhase,
  expireSecretAgentsRecovery,
  passSecretAgentsTurn,
  pauseSecretAgentsMatch,
  resumeSecretAgentsMatch,
  submitSecretAgentsClue,
  toggleSecretAgentsNomination,
  type SecretAgentsMatchState,
} from '../src/modules/game/experimental/secret-agents/state.js';
import {
  clearSecretAgentsTimerRuntime,
  reconcileSecretAgentsConnectivity,
} from '../src/modules/game/experimental/secret-agents/phase-timer.js';
import {
  deleteSecretAgentsMatch,
  getSecretAgentsMatch,
  setSecretAgentsMatch,
} from '../src/modules/game/experimental/secret-agents/store.js';
import { replaceGameShellForTests } from '../src/modules/game/game.service.js';
import {
  SECRET_AGENTS_PROVISIONAL_WORDS,
  validateSecretAgentsProvisionalWords,
} from '../src/modules/game/experimental/secret-agents/provisional-words.js';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

function seeded(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function assignments(extra = 0): Record<string, SecretAgentsAssignment> {
  const base: Record<string, SecretAgentsAssignment> = {
    redSpy: { team: 'red', role: 'spymaster', locked: false },
    redOp: { team: 'red', role: 'operative', locked: false },
    blueSpy: { team: 'blue', role: 'spymaster', locked: false },
    blueOp: { team: 'blue', role: 'operative', locked: false },
  };
  for (let index = 0; index < extra; index += 1) {
    base[`extra${index}`] = {
      team: index % 3 === 0 ? 'red' : 'blue',
      role: index % 4 === 0 ? 'spymaster' : 'operative',
      locked: false,
    };
  }
  return base;
}

function match(now = 1_000, settings = SECRET_AGENTS_DEFAULT_SETTINGS) {
  const roster = assignments();
  return createSecretAgentsMatch({
    assignments: roster,
    playerNames: Object.fromEntries(Object.keys(roster).map((id) => [id, id])),
    settings,
    random: seeded(44),
    now,
  });
}

function shellFor(state: SecretAgentsMatchState): GameShellState {
  return {
    shellId: 'shell',
    roomId: 'room',
    gameId: SECRET_AGENTS_GAME_ID,
    phase: 'PLAYING',
    hostPlayerId: 'redSpy',
    players: Object.keys(state.assignments).map((id) => ({
      id,
      name: state.playerNames[id]!,
      isHost: id === 'redSpy',
      isConnected: true,
      isReady: true,
      isSpectator: false,
    })),
    readyPlayerIds: [],
    countdownSeconds: 1,
    countdownRemainingSeconds: null,
    gameTimerSeconds: null,
    gameTimerRemainingSeconds: null,
    startedAt: new Date(0).toISOString(),
    finishedAt: null,
    updatedAt: new Date(0).toISOString(),
    matchParticipantIds: [...state.playerIds],
  };
}

function cluePhaseForTeam(state: SecretAgentsMatchState, team: 'red' | 'blue' = 'red') {
  return {
    ...state,
    activeTeam: team,
    phase: 'clue' as const,
    clue: null,
    deadlineAtMs: null,
  };
}

function guessingState(state: SecretAgentsMatchState, value: number | 'unlimited' = 2) {
  const clueState = cluePhaseForTeam(state, 'red');
  const result = submitSecretAgentsClue(
    clueState,
    'redSpy',
    { turnId: clueState.turnId, word: 'فضاء', value },
    1_000,
  );
  assert.equal(result.ok, true);
  return result.ok ? result.match : clueState;
}

test('provisional bank is replaceable, nonempty, unique, and supports several boards', () => {
  const validation = validateSecretAgentsProvisionalWords();
  assert.equal(validation.success, true);
  assert.ok(SECRET_AGENTS_PROVISIONAL_WORDS.length >= 100);
});

test('board has 25 distinct words and exact randomized 9/8/7/1 distribution', () => {
  const starters = new Set<string>();
  for (let seed = 1; seed <= 20; seed += 1) {
    const board = createSecretAgentsBoard(seeded(seed));
    starters.add(board.startingTeam);
    assert.equal(board.cards.length, 25);
    assert.equal(new Set(board.cards.map((card) => card.word)).size, 25);
    assert.equal(
      countSecretAgentsByType({ ...match(), cards: board.cards }, board.startingTeam),
      9,
    );
    assert.equal(
      countSecretAgentsByType(
        { ...match(), cards: board.cards },
        board.startingTeam === 'red' ? 'blue' : 'red',
      ),
      8,
    );
    assert.equal(board.cards.filter((card) => card.type === 'neutral').length, 7);
    assert.equal(board.cards.filter((card) => card.type === 'assassin').length, 1);
  }
  assert.deepEqual([...starters].sort(), ['blue', 'red']);
});

test('manual roster accepts four, unequal teams, multiple spymasters, and fifteen', () => {
  const four = assignments();
  assert.equal(
    validateSecretAgentsRoster({ assignments: four, eligiblePlayerIds: Object.keys(four) }).success,
    true,
  );
  const fifteen = assignments(11);
  assert.equal(
    validateSecretAgentsRoster({
      assignments: fifteen,
      eligiblePlayerIds: Object.keys(fifteen),
    }).success,
    true,
  );
  const sixteen = assignments(12);
  assert.equal(
    validateSecretAgentsRoster({
      assignments: sixteen,
      eligiblePlayerIds: Object.keys(sixteen),
    }).success,
    false,
  );
  const invalid = { ...four };
  invalid.blueOp = { team: 'blue', role: 'spymaster', locked: false };
  assert.equal(
    validateSecretAgentsRoster({
      assignments: invalid,
      eligiblePlayerIds: Object.keys(invalid),
    }).success,
    false,
  );
});

test('self-selection is editable before start and random distribution is valid', () => {
  clearAllSecretAgentsLobbyStatesForTests();
  assert.equal(
    assignSecretAgentsLobbyPlayer('room', 'p1', { team: 'red', role: 'operative' }).success,
    true,
  );
  assert.equal(
    assignSecretAgentsLobbyPlayer('room', 'p1', { team: 'blue', role: 'spymaster' }).success,
    true,
  );
  assert.equal(getSecretAgentsLobbyState('room').assignments.p1?.team, 'blue');
  const state = randomizeSecretAgentsLobbyAssignments('room', ['a', 'b', 'c', 'd', 'e'], seeded(1));
  assert.equal(
    validateSecretAgentsRoster({
      assignments: state.assignments,
      eligiblePlayerIds: ['a', 'b', 'c', 'd', 'e'],
    }).success,
    true,
  );
  assert.equal(
    assignSecretAgentsLobbyPlayer('room', 'evil', { team: 'red', role: 'operative', userId: 'x' })
      .success,
    false,
  );
});

test('settings are independent, bounded, and reject unknown browser claims', () => {
  clearAllSecretAgentsLobbyStatesForTests();
  assert.equal(updateSecretAgentsLobbySettings('room', { clueTimerEnabled: true }).success, true);
  assert.equal(
    updateSecretAgentsLobbySettings('room', { operativeTimerEnabled: true }).success,
    true,
  );
  assert.equal(
    updateSecretAgentsLobbySettings('room', { correctGuessBonusSeconds: 0 }).success,
    true,
  );
  assert.equal(updateSecretAgentsLobbySettings('room', { clueSeconds: 14 }).success, false);
  assert.equal(updateSecretAgentsLobbySettings('room', { premium: true }).success, false);
});

test('all four timer combinations produce independent authoritative deadlines', () => {
  for (const [clueTimerEnabled, operativeTimerEnabled] of [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ] as const) {
    const current = cluePhaseForTeam(
      match(1_000, {
        ...SECRET_AGENTS_DEFAULT_SETTINGS,
        clueTimerEnabled,
        operativeTimerEnabled,
      }),
    );
    current.deadlineAtMs = clueTimerEnabled ? 91_000 : null;
    assert.equal(current.deadlineAtMs !== null, clueTimerEnabled);
    const accepted = submitSecretAgentsClue(
      current,
      'redSpy',
      { turnId: current.turnId, word: 'فضاء', value: 1 },
      1_000,
    );
    assert.equal(accepted.ok, true);
    assert.equal(accepted.ok && accepted.match.deadlineAtMs !== null, operativeTimerEnabled);
  }
});

test('first accepted clue wins and rejects a visible board word', () => {
  const current = cluePhaseForTeam(match());
  const visible = current.cards[0]!.word;
  assert.equal(
    submitSecretAgentsClue(current, 'redSpy', { turnId: current.turnId, word: visible, value: 1 })
      .ok,
    false,
  );
  const first = submitSecretAgentsClue(
    current,
    'redSpy',
    { turnId: current.turnId, word: 'فضاء', value: 2 },
    1_000,
  );
  assert.equal(first.ok, true);
  assert.equal(first.ok && first.match.maxConfirmedGuesses, 3);
  assert.equal(
    first.ok &&
      submitSecretAgentsClue(
        first.match,
        'redSpy',
        { turnId: first.match.turnId, word: 'زمن', value: 1 },
        1_000,
      ).ok,
    false,
  );
  assert.equal(
    submitSecretAgentsClue(current, 'redOp', { turnId: current.turnId, word: 'فضاء', value: 2 }).ok,
    false,
  );
});

test('zero and infinity clues have no numerical guess cap', () => {
  assert.equal(guessingState(match(), 0).maxConfirmedGuesses, null);
  assert.equal(guessingState(match(), 'unlimited').maxConfirmedGuesses, null);
});

test('nominations are independent, private to own team, removable, and absent from log', () => {
  const current = guessingState(match());
  current.assignments.redOp2 = { team: 'red', role: 'operative', locked: true };
  current.playerIds.push('redOp2');
  current.playerNames.redOp2 = 'زميل';
  const cardId = current.cards[0]!.id;
  const first = toggleSecretAgentsNomination(current, 'redOp', {
    turnId: current.turnId,
    cardId,
    requestId: 'request-1',
  });
  assert.equal(first.ok, true);
  const second = first.ok
    ? toggleSecretAgentsNomination(first.match, 'redOp2', {
        turnId: first.match.turnId,
        cardId,
        requestId: 'request-2',
      })
    : first;
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.match.nominationsByCardId[cardId]?.length, 2);
  const redView = buildSecretAgentsPlayerView(second.match, 'redSpy', shellFor(second.match));
  const blueView = buildSecretAgentsPlayerView(second.match, 'blueOp', shellFor(second.match));
  assert.equal(redView.cards.find((card) => card.id === cardId)?.nominations.length, 2);
  assert.equal(blueView.cards.find((card) => card.id === cardId)?.nominations.length, 0);
  assert.equal(
    second.match.log.some((entry) => entry.text.includes('ترشيح')),
    false,
  );
  const removed = toggleSecretAgentsNomination(second.match, 'redOp', {
    turnId: second.match.turnId,
    cardId,
    requestId: 'request-3',
  });
  assert.equal(removed.ok && removed.match.nominationsByCardId[cardId]?.length, 1);
});

test('any active operative confirms without nomination and replay cannot double reveal', () => {
  const current = guessingState(match());
  const ownIndex = current.cards.findIndex((card) => card.type === 'red');
  current.cards = current.cards.map((card, index) =>
    index === ownIndex ? { ...card, revealed: false } : card,
  );
  const cardId = current.cards[ownIndex]!.id;
  const first = confirmSecretAgentsCard(
    current,
    'redOp',
    {
      turnId: current.turnId,
      cardId,
      requestId: 'confirm-1',
    },
    1_100,
  );
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const replay = confirmSecretAgentsCard(
    first.match,
    'redOp',
    {
      turnId: current.turnId,
      cardId,
      requestId: 'confirm-1',
    },
    1_200,
  );
  assert.equal(replay.ok, true);
  assert.equal(replay.ok && replay.changed, false);
  assert.equal(
    first.match.log.filter((entry) => entry.cardWord === current.cards[ownIndex]!.word).length,
    1,
  );
});

test('correct, neutral, opposing, assassin, own win, and opponent win follow exact outcomes', () => {
  const base = guessingState(match());
  const run = (type: 'red' | 'blue' | 'neutral' | 'assassin', onlyAgent = false) => {
    const index = base.cards.findIndex((card) => card.type === type);
    const prepared = {
      ...base,
      cards: base.cards.map((card, cardIndex) => ({
        ...card,
        revealed: onlyAgent && card.type === type && cardIndex !== index ? true : card.revealed,
      })),
    };
    return confirmSecretAgentsCard(
      prepared,
      'redOp',
      {
        turnId: prepared.turnId,
        cardId: prepared.cards[index]!.id,
        requestId: `outcome-${type}-${onlyAgent}`,
      },
      1_100,
    );
  };
  assert.equal(run('red').ok, true);
  const neutral = run('neutral');
  assert.equal(neutral.ok && neutral.match.activeTeam, 'blue');
  const opposing = run('blue');
  assert.equal(opposing.ok && opposing.match.activeTeam, 'blue');
  const assassin = run('assassin');
  assert.equal(assassin.ok && assassin.match.winnerTeam, 'blue');
  const ownWin = run('red', true);
  assert.equal(ownWin.ok && ownWin.match.winnerTeam, 'red');
  const opponentWin = run('blue', true);
  assert.equal(opponentWin.ok && opponentWin.match.winnerTeam, 'blue');
  assert.equal(opponentWin.ok && opponentWin.match.resultReason, 'opponent-agent');
});

test('N+1 ends after the allowed final correct guess and pass is idempotent', () => {
  let current = guessingState(match(), 1);
  const own = current.cards.filter((card) => card.type === 'red').slice(0, 2);
  for (const [index, card] of own.entries()) {
    const result = confirmSecretAgentsCard(
      current,
      'redOp',
      {
        turnId: current.turnId,
        cardId: card.id,
        requestId: `limit-000${index}`,
      },
      1_100 + index,
    );
    assert.equal(result.ok, true);
    if (result.ok) current = result.match;
  }
  assert.equal(current.activeTeam, 'blue');
  const passState = guessingState(match());
  const first = passSecretAgentsTurn(passState, 'redOp', {
    turnId: passState.turnId,
    requestId: 'pass-001',
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const replay = passSecretAgentsTurn(first.match, 'redOp', {
    turnId: passState.turnId,
    requestId: 'pass-001',
  });
  assert.equal(replay.ok && replay.changed, false);
});

test('operative timer is continuous and every correct guess earns capped bonus', () => {
  const settings = {
    ...SECRET_AGENTS_DEFAULT_SETTINGS,
    operativeTimerEnabled: true,
    operativeSeconds: 60,
    correctGuessBonusSeconds: 10,
  };
  const current = guessingState(match(1_000, settings));
  current.deadlineAtMs = 56_000; // 55 seconds remain at t=1000.
  const own = current.cards.find((card) => card.type === 'red')!;
  const first = confirmSecretAgentsCard(
    current,
    'redOp',
    {
      turnId: current.turnId,
      cardId: own.id,
      requestId: 'bonus-001',
    },
    1_000,
  );
  assert.equal(first.ok && first.match.deadlineAtMs, 61_000);
  if (!first.ok) return;
  const own2 = first.match.cards.find((card) => card.type === 'red' && !card.revealed)!;
  const second = confirmSecretAgentsCard(
    first.match,
    'redOp',
    {
      turnId: first.match.turnId,
      cardId: own2.id,
      requestId: 'bonus-002',
    },
    33_000,
  );
  assert.equal(second.ok && second.match.deadlineAtMs, 71_000);
});

test('deadline expiration changes turn and never auto-confirms a nomination', () => {
  let current = guessingState(
    match(1_000, {
      ...SECRET_AGENTS_DEFAULT_SETTINGS,
      operativeTimerEnabled: true,
      operativeSeconds: 15,
    }),
  );
  const card = current.cards[0]!;
  const nominated = toggleSecretAgentsNomination(
    current,
    'redOp',
    {
      turnId: current.turnId,
      cardId: card.id,
      requestId: 'nom-timeout',
    },
    1_100,
  );
  assert.equal(nominated.ok, true);
  if (nominated.ok) current = { ...nominated.match, deadlineAtMs: 2_000 };
  const expired = expireSecretAgentsPhase(current, current.turnId, 'guessing', 2_000);
  assert.ok(expired);
  assert.equal(expired?.activeTeam, 'blue');
  assert.equal(expired?.cards.find((entry) => entry.id === card.id)?.revealed, false);
  assert.deepEqual(expired?.nominationsByCardId, {});
});

test('mid-match join locks role, honors cap, and isolates the key', () => {
  const current = match();
  const joined = addSecretAgentsMidMatchPlayer(current, {
    playerId: 'lateSpy',
    playerName: 'قائد جديد',
    team: current.activeTeam,
    role: 'spymaster',
  });
  assert.equal(joined.ok, true);
  if (!joined.ok) return;
  assert.equal(
    addSecretAgentsMidMatchPlayer(joined.match, {
      playerId: 'lateSpy',
      playerName: 'قائد جديد',
      team: 'blue',
      role: 'operative',
    }).ok,
    false,
  );
  const joinedShell = shellFor(joined.match);
  assert.ok(buildSecretAgentsPlayerView(joined.match, 'lateSpy', joinedShell).secretKey);
  assert.equal(buildSecretAgentsPlayerView(joined.match, 'redOp', joinedShell).secretKey, null);
  assert.equal(buildSecretAgentsPlayerView(joined.match, 'unknown', joinedShell).secretKey, null);

  const full = createSecretAgentsMatch({
    assignments: assignments(11),
    playerNames: {},
    random: seeded(4),
  });
  assert.equal(
    addSecretAgentsMidMatchPlayer(full, {
      playerId: 'sixteenth',
      playerName: '16',
      team: 'red',
      role: 'operative',
    }).ok,
    false,
  );
});

test('pause preserves time and state, resume restores it, expiry ends without winner', () => {
  const current = { ...guessingState(match()), deadlineAtMs: 11_000 };
  const paused = pauseSecretAgentsMatch(current, 'missing-operative', 181_000, 1_000);
  assert.equal(paused.pausedRemainingMs, 10_000);
  assert.equal(paused.cards, current.cards);
  const resumed = resumeSecretAgentsMatch(paused, 5_000);
  assert.equal(resumed.phase, 'guessing');
  assert.equal(resumed.deadlineAtMs, 15_000);
  const expired = expireSecretAgentsRecovery(paused);
  assert.equal(expired.phase, 'completed');
  assert.equal(expired.winnerTeam, null);
  assert.equal(expired.resultReason, 'recovery-expired');
});

test('one connected eligible actor keeps play running; losing all pauses and reconnect resumes', () => {
  const current = cluePhaseForTeam(match());
  current.assignments.redSpy2 = { team: 'red', role: 'spymaster', locked: true };
  current.playerIds.push('redSpy2');
  current.playerNames.redSpy2 = 'قائد ثان';
  const shell = shellFor(current);
  shell.players.push({
    id: 'redSpy2',
    name: 'قائد ثان',
    isHost: false,
    isConnected: true,
    isReady: true,
    isSpectator: false,
  });
  shell.matchParticipantIds?.push('redSpy2');
  shell.players = shell.players.map((player) =>
    player.id === 'redSpy' ? { ...player, isConnected: false } : player,
  );
  replaceGameShellForTests(shell);
  setSecretAgentsMatch('room', current);
  const io = { to: () => ({ emit: () => undefined }) } as never;
  reconcileSecretAgentsConnectivity(io, 'room');
  assert.equal(getSecretAgentsMatch('room')?.phase, 'clue');

  replaceGameShellForTests({
    ...shell,
    players: shell.players.map((player) =>
      player.id === 'redSpy2' ? { ...player, isConnected: false } : player,
    ),
  });
  reconcileSecretAgentsConnectivity(io, 'room');
  assert.equal(getSecretAgentsMatch('room')?.phase, 'paused');

  replaceGameShellForTests(shell);
  reconcileSecretAgentsConnectivity(io, 'room');
  assert.equal(getSecretAgentsMatch('room')?.phase, 'clue');

  const guessing = guessingState(current);
  setSecretAgentsMatch('room', guessing);
  replaceGameShellForTests({
    ...shell,
    players: shell.players.map((player) =>
      player.id === 'redOp' ? { ...player, isConnected: false } : player,
    ),
  });
  reconcileSecretAgentsConnectivity(io, 'room');
  assert.equal(getSecretAgentsMatch('room')?.pauseReason, 'missing-operative');
  clearSecretAgentsTimerRuntime('room');
  deleteSecretAgentsMatch('room');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
