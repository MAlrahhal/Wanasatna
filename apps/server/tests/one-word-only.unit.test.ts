import assert from 'node:assert/strict';
import type { GameShellState, OneWordOnlySettings } from '@wanasatna/shared';
import { ONE_WORD_ONLY_DEFAULT_SETTINGS, ONE_WORD_ONLY_GAME_ID } from '@wanasatna/shared';
import {
  getOneWordOnlyLobbySettings,
  hydrateOneWordOnlyLobbySettings,
  persistOneWordOnlySettings,
  validateOneWordOnlySettings,
} from '../src/modules/game/experimental/one-word-only/lobby-settings.js';
import {
  normalizeOneWordClue,
  validateOneWordClue,
} from '../src/modules/game/experimental/one-word-only/normalization.js';
import {
  ONE_WORD_ONLY_PROVISIONAL_CONTENT,
  validateOneWordOnlyProvisionalContent,
} from '../src/modules/game/experimental/one-word-only/provisional-content.js';
import {
  advanceOneWordOnlyRound,
  buildOneWordOnlyPlayerView,
  confirmOneWordOnlyAnswer,
  createOneWordOnlyMatch,
  expireOneWordOnlyPhase,
  handleOneWordOnlyPermanentLeave,
  reconcileOneWordOnlyGuesserConnection,
  submitOneWordOnlyClue,
  type OneWordOnlyMatchState,
} from '../src/modules/game/experimental/one-word-only/state.js';

let passed = 0;
let failed = 0;
function test(name: string, run: () => void): void {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

function settings(overrides: Partial<OneWordOnlySettings> = {}): OneWordOnlySettings {
  return { ...ONE_WORD_ONLY_DEFAULT_SETTINGS, ...overrides } as OneWordOnlySettings;
}

function create(playerIds = ['p1', 'p2', 'p3', 'p4'], now = 1_000) {
  return createOneWordOnlyMatch({
    playerIds,
    playerNames: Object.fromEntries(playerIds.map((id) => [id, id.toUpperCase()])),
    settings: settings(),
    random: () => 0,
    now,
  });
}

function shell(match: OneWordOnlyMatchState, hostPlayerId = 'p1'): GameShellState {
  return {
    shellId: 'shell',
    roomId: 'room',
    gameId: ONE_WORD_ONLY_GAME_ID,
    phase: 'PLAYING',
    hostPlayerId,
    players: match.playerIds.map((id) => ({
      id,
      name: match.playerNames[id] ?? id,
      isHost: id === hostPlayerId,
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
    matchParticipantIds: [...match.playerIds],
  };
}

function submit(match: OneWordOnlyMatchState, playerId: string, clue: string, connected = true) {
  const result = submitOneWordOnlyClue(
    match,
    playerId,
    { roundId: match.round.roundId, clue },
    connected,
    2_000,
  );
  assert.equal(result.ok, true, result.ok ? '' : result.message);
  return result.ok ? result.match : match;
}

test('content bank has 30 stable entries and eight normalized-unique options each', () => {
  assert.equal(ONE_WORD_ONLY_PROVISIONAL_CONTENT.length, 30);
  assert.deepEqual(validateOneWordOnlyProvisionalContent(), { success: true, count: 30 });
  assert.equal(new Set(ONE_WORD_ONLY_PROVISIONAL_CONTENT.map((entry) => entry.id)).size, 30);
  assert.ok(ONE_WORD_ONLY_PROVISIONAL_CONTENT.every((entry) => entry.distractors.length === 7));
});

test('normalization folds approved variants but deliberately preserves ى versus ي', () => {
  assert.equal(normalizeOneWordClue('  قَـهْوَة  '), 'قهوه');
  assert.equal(normalizeOneWordClue('قهوه'), 'قهوه');
  assert.equal(normalizeOneWordClue('إختبار'), normalizeOneWordClue('اختبار'));
  assert.equal(normalizeOneWordClue('Hello'), 'hello');
  assert.notEqual(normalizeOneWordClue('على'), normalizeOneWordClue('علي'));
  for (const bad of ['كلمتان هنا', 'word-2', '🎯', '', 'أ'.repeat(31)]) {
    assert.equal(validateOneWordClue(bad).success, false);
  }
  assert.equal(validateOneWordClue('واضح').success, true);
});

test('settings accept only explicit provisional values and preserve unrelated room JSON', () => {
  const valid = settings({ roundCount: 7, clueSeconds: 45, guessSeconds: 20 });
  assert.deepEqual(validateOneWordOnlySettings(valid), { success: true, data: valid });
  assert.equal(validateOneWordOnlySettings({ ...valid, isAdmin: true }).success, false);
  assert.equal(validateOneWordOnlySettings({ ...valid, playerId: 'p1' }).success, false);
  assert.equal(validateOneWordOnlySettings({ ...valid, roundCount: 8 }).success, false);
  assert.equal(validateOneWordOnlySettings({ ...valid, clueSeconds: '30' }).success, false);
  const persisted = persistOneWordOnlySettings({ untouched: 1 }, valid);
  hydrateOneWordOnlyLobbySettings('room', persisted);
  assert.deepEqual(getOneWordOnlyLobbySettings('room'), valid);
  assert.equal((persisted as Record<string, unknown>).untouched, 1);
});

test('server creates a fair first rotation and owns exactly eight stable options', () => {
  const match = create();
  assert.equal(match.round.eligibleWriterIds.length, 3);
  assert.equal(match.round.options.length, 8);
  assert.equal(new Set(match.round.options.map((option) => option.id)).size, 8);
  assert.ok(match.round.options.some((option) => option.id === match.round.correctOptionId));
  assert.ok(match.round.options.every((option) => !option.id.includes(match.round.contentId)));
  assert.equal(match.round.deadlineAtMs, 31_000);
});

test('role projections give the secret only to writers and hide every draft from others', () => {
  let match = create();
  const writer = match.round.eligibleWriterIds[0]!;
  const otherWriter = match.round.eligibleWriterIds[1]!;
  match = submit(match, writer, 'ملكي');
  const writerView = buildOneWordOnlyPlayerView(match, writer, shell(match));
  const otherView = buildOneWordOnlyPlayerView(match, otherWriter, shell(match));
  const guesserView = buildOneWordOnlyPlayerView(match, match.round.guesserPlayerId, shell(match));
  assert.equal(writerView.privateAnswer, match.round.answer);
  assert.equal(writerView.ownSubmittedClue, 'ملكي');
  assert.equal(otherView.ownSubmittedClue, null);
  assert.equal(guesserView.privateAnswer, null);
  assert.deepEqual(guesserView.survivingClues, []);
  assert.deepEqual(guesserView.answerOptions, []);
  assert.equal(JSON.stringify(guesserView).includes('ملكي'), false);
});

test('invalid, answer-equal, stale, repeated, and guesser clues are rejected', () => {
  const match = create();
  const writer = match.round.eligibleWriterIds[0]!;
  assert.equal(
    submitOneWordOnlyClue(match, writer, { roundId: match.round.roundId, clue: 'كلمتان هنا' }, true)
      .ok,
    false,
  );
  assert.equal(
    submitOneWordOnlyClue(
      match,
      writer,
      { roundId: match.round.roundId, clue: match.round.answer },
      true,
    ).ok,
    false,
  );
  assert.equal(
    submitOneWordOnlyClue(
      match,
      match.round.guesserPlayerId,
      { roundId: match.round.roundId, clue: 'واضح' },
      true,
    ).ok,
    false,
  );
  assert.equal(
    submitOneWordOnlyClue(match, writer, { roundId: 'stale', clue: 'واضح' }, true).ok,
    false,
  );
  const submitted = submit(match, writer, 'واضح');
  assert.equal(
    submitOneWordOnlyClue(
      submitted,
      writer,
      { roundId: submitted.round.roundId, clue: 'قوي' },
      true,
    ).ok,
    false,
  );
});

test('all-submit closes early and every member of an orthographic duplicate group is removed', () => {
  let match = create();
  const writers = match.round.eligibleWriterIds;
  match = submit(match, writers[0]!, 'قهوة');
  match = submit(match, writers[1]!, 'قهوه');
  match = submit(match, writers[2]!, 'قَـهْوَة');
  assert.equal(match.round.phase, 'guessing');
  assert.deepEqual(match.round.survivingPlayerIds, []);
  assert.equal(match.round.removedPlayerIds.length, 3);
  const guesser = buildOneWordOnlyPlayerView(match, match.round.guesserPlayerId, shell(match));
  assert.deepEqual(guesser.survivingClues, []);
  assert.equal(guesser.answerOptions.length, 8);
  assert.equal(JSON.stringify(guesser).includes('قهوة'), false);
});

test('unique clues reach guessing while duplicates and authors appear only on reveal', () => {
  let match = create();
  const writers = match.round.eligibleWriterIds;
  match = submit(match, writers[0]!, 'ملكي');
  match = submit(match, writers[1]!, 'قهوة');
  match = submit(match, writers[2]!, 'قهوه');
  const guesserId = match.round.guesserPlayerId;
  const guessing = buildOneWordOnlyPlayerView(match, guesserId, shell(match));
  assert.deepEqual(guessing.survivingClues, ['ملكي']);
  assert.equal(JSON.stringify(guessing).includes('قهوة'), false);
  const confirmed = confirmOneWordOnlyAnswer(
    match,
    guesserId,
    {
      roundId: match.round.roundId,
      optionId: match.round.correctOptionId,
      requestId: 'request-0001',
    },
    2_500,
  );
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  const reveal = buildOneWordOnlyPlayerView(confirmed.match, guesserId, shell(confirmed.match));
  assert.equal(reveal.roundWasCorrect, true);
  assert.equal(reveal.correctRoundCount, 1);
  assert.deepEqual(
    reveal.revealClues.map((entry) => entry.survived),
    [true, false, false],
  );
});

test('only the guesser confirms an authoritative option once before the deadline', () => {
  let match = create(['p1', 'p2', 'p3']);
  const writers = match.round.eligibleWriterIds;
  match = submit(match, writers[0]!, 'قوي');
  match = submit(match, writers[1]!, 'ملكي');
  const guesser = match.round.guesserPlayerId;
  const option = match.round.options.find((entry) => entry.id !== match.round.correctOptionId)!;
  assert.equal(
    confirmOneWordOnlyAnswer(match, writers[0]!, {
      roundId: match.round.roundId,
      optionId: option.id,
      requestId: 'request-0002',
    }).ok,
    false,
  );
  assert.equal(
    confirmOneWordOnlyAnswer(match, guesser, {
      roundId: 'stale',
      optionId: option.id,
      requestId: 'request-0003',
    }).ok,
    false,
  );
  const confirmed = confirmOneWordOnlyAnswer(
    match,
    guesser,
    { roundId: match.round.roundId, optionId: option.id, requestId: 'request-0004' },
    match.round.deadlineAtMs! - 1,
  );
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  assert.equal(confirmed.match.round.resultReason, 'wrong');
  assert.equal(
    expireOneWordOnlyPhase(
      confirmed.match,
      match.round.roundId,
      'guessing',
      true,
      match.round.deadlineAtMs!,
    ),
    null,
  );
  assert.equal(
    confirmOneWordOnlyAnswer(confirmed.match, guesser, {
      roundId: match.round.roundId,
      optionId: option.id,
      requestId: 'request-0004',
    }).ok,
    false,
  );
  assert.equal(
    confirmOneWordOnlyAnswer(
      match,
      guesser,
      { roundId: match.round.roundId, optionId: option.id, requestId: 'request-0005' },
      match.round.deadlineAtMs!,
    ).ok,
    false,
  );
});

test('guesser disconnect waits with a full window, then pause/resume preserves remaining time', () => {
  let match = create(['p1', 'p2', 'p3']);
  const writers = match.round.eligibleWriterIds;
  match = submit(match, writers[0]!, 'ملكي', false);
  match = submit(match, writers[1]!, 'قوي', false);
  assert.equal(match.round.phase, 'guessing');
  assert.equal(match.round.deadlineAtMs, null);
  assert.equal(match.round.pausedGuessRemainingMs, 30_000);
  match = reconcileOneWordOnlyGuesserConnection(match, true, 5_000);
  assert.equal(match.round.deadlineAtMs, 35_000);
  match = reconcileOneWordOnlyGuesserConnection(match, false, 15_000);
  assert.equal(match.round.pausedGuessRemainingMs, 20_000);
  match = reconcileOneWordOnlyGuesserConnection(match, true, 20_000);
  assert.equal(match.round.deadlineAtMs, 40_000);
});

test('timeouts, host transfer, late admission, guesser expiry, and minimum players converge safely', () => {
  let match = create(['p1', 'p2', 'p3'], 1_000);
  match = expireOneWordOnlyPhase(match, match.round.roundId, 'clue-writing', true, 31_000)!;
  match = expireOneWordOnlyPhase(
    match,
    match.round.roundId,
    'guessing',
    true,
    match.round.deadlineAtMs!,
  )!;
  assert.equal(match.round.resultReason, 'no-answer');
  assert.equal(buildOneWordOnlyPlayerView(match, 'p2', shell(match, 'p2')).canAdvance, true);
  const firstGuesser = match.round.guesserPlayerId;
  const advanced = advanceOneWordOnlyRound(
    match,
    [
      { playerId: 'p1', name: 'P1' },
      { playerId: 'p2', name: 'P2' },
      { playerId: 'p3', name: 'P3' },
      { playerId: 'p4', name: 'P4' },
    ],
    'request-advance',
    70_000,
    () => 0,
  );
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  assert.notEqual(advanced.match.round.guesserPlayerId, firstGuesser);
  assert.ok(advanced.match.playerIds.includes('p4'));
  assert.ok(
    advanced.match.guesserQueue.includes('p4') || advanced.match.round.guesserPlayerId === 'p4',
  );
  const preExpanded = {
    ...match,
    playerIds: [...match.playerIds, 'p4'],
    playerNames: { ...match.playerNames, p4: 'P4' },
    scores: { ...match.scores, p4: 0 },
  };
  const advancedPreExpanded = advanceOneWordOnlyRound(
    preExpanded,
    [
      { playerId: 'p1', name: 'P1' },
      { playerId: 'p2', name: 'P2' },
      { playerId: 'p3', name: 'P3' },
      { playerId: 'p4', name: 'P4' },
    ],
    'request-pre-expanded',
    70_000,
    () => 0,
    ['p4'],
  );
  assert.equal(advancedPreExpanded.ok, true);
  if (advancedPreExpanded.ok) {
    assert.ok(
      advancedPreExpanded.match.guesserQueue.includes('p4') ||
        advancedPreExpanded.match.round.guesserPlayerId === 'p4',
    );
  }
  const guesserLeft = handleOneWordOnlyPermanentLeave(
    advanced.match,
    advanced.match.round.guesserPlayerId,
    71_000,
  );
  assert.equal(guesserLeft.round.phase, 'round-reveal');
  assert.equal(guesserLeft.round.resultReason, 'guesser-left');
  const active = guesserLeft.playerIds.filter((id) => !guesserLeft.departedPlayerIds.includes(id));
  let insufficient = handleOneWordOnlyPermanentLeave(guesserLeft, active[0]!, 72_000);
  insufficient = handleOneWordOnlyPermanentLeave(insufficient, active[1]!, 73_000);
  assert.equal(insufficient.round.resultReason, 'insufficient-players');
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
