import assert from 'node:assert/strict';
import type { EmojiLanguageSettings, GameShellState } from '@wanasatna/shared';
import { EMOJI_LANGUAGE_DEFAULT_SETTINGS, EMOJI_LANGUAGE_GAME_ID } from '@wanasatna/shared';
import {
  clearAllEmojiLanguageLobbySettingsForTests,
  getEmojiLanguageLobbySettings,
  hydrateEmojiLanguageLobbySettings,
  persistEmojiLanguageSettings,
  readPersistedEmojiLanguageSettings,
  validateEmojiLanguageSettings,
} from '../src/modules/game/experimental/emoji-language/lobby-settings.js';
import {
  EMOJI_LANGUAGE_PLAYER_PROMPTS,
  EMOJI_LANGUAGE_SERVER_PUZZLES,
  validateEmojiLanguageProvisionalContent,
} from '../src/modules/game/experimental/emoji-language/provisional-content.js';
import {
  buildEmojiLanguagePlayerView,
  createEmojiLanguageMatch,
  expireEmojiLanguagePhase,
  handleEmojiLanguagePermanentLeave,
  submitEmojiLanguageClue,
  submitEmojiLanguageGuess,
  type EmojiLanguageMatchState,
} from '../src/modules/game/experimental/emoji-language/state.js';

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

function settings(overrides: Partial<EmojiLanguageSettings> = {}): EmojiLanguageSettings {
  return { ...EMOJI_LANGUAGE_DEFAULT_SETTINGS, ...overrides } as EmojiLanguageSettings;
}

function create(
  mode: EmojiLanguageSettings['mode'] = 'player-clue',
  playerIds = ['p1', 'p2', 'p3'],
  now = 1_000,
) {
  return createEmojiLanguageMatch({
    playerIds,
    playerNames: Object.fromEntries(playerIds.map((id) => [id, id.toUpperCase()])),
    settings: settings({ mode }),
    random: () => 0,
    now,
  });
}

function shell(match: EmojiLanguageMatchState, extraPlayerIds: string[] = []): GameShellState {
  const all = [...match.playerIds, ...extraPlayerIds];
  return {
    shellId: 'shell',
    roomId: 'room',
    gameId: EMOJI_LANGUAGE_GAME_ID,
    phase: 'PLAYING',
    hostPlayerId: match.playerIds[0]!,
    players: all.map((id) => ({
      id,
      name: match.playerNames[id] ?? id,
      isHost: id === match.playerIds[0],
      isConnected: true,
      isReady: true,
      isSpectator: extraPlayerIds.includes(id),
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

function clue(match: EmojiLanguageMatchState, now = 2_000): EmojiLanguageMatchState {
  const result = submitEmojiLanguageClue(
    match,
    match.round.writerPlayerId!,
    { roundId: match.round.roundId, emojis: ['😀', '☕'] },
    now,
  );
  assert.equal(result.ok, true);
  return result.ok ? result.match : match;
}

function expire(match: EmojiLanguageMatchState, now: number): EmojiLanguageMatchState {
  const result = expireEmojiLanguagePhase(
    match,
    match.round.roundId,
    match.round.phase,
    now,
    () => 0,
  );
  assert.ok(result);
  return result!;
}

test('provisional banks are reviewable, unique per mode, and use approved emoji tokens', () => {
  assert.equal(validateEmojiLanguageProvisionalContent().success, true);
  assert.ok(EMOJI_LANGUAGE_PLAYER_PROMPTS.length >= 15);
  assert.ok(EMOJI_LANGUAGE_SERVER_PUZZLES.length >= 15);
  assert.equal(new Set(EMOJI_LANGUAGE_PLAYER_PROMPTS.map((entry) => entry.id)).size, 15);
  assert.equal(new Set(EMOJI_LANGUAGE_SERVER_PUZZLES.map((entry) => entry.id)).size, 15);
});

test('settings use explicit options, reject extra claims, and persist beside room JSON', () => {
  const valid = settings({ mode: 'server-puzzle', roundCount: 7, guessingSeconds: 60 });
  assert.deepEqual(validateEmojiLanguageSettings(valid), { success: true, data: valid });
  assert.equal(validateEmojiLanguageSettings({ ...valid, isAdmin: true }).success, false);
  assert.equal(validateEmojiLanguageSettings({ ...valid, roundCount: 6 }).success, false);
  assert.equal(validateEmojiLanguageSettings({ ...valid, guessingSeconds: '60' }).success, false);
  const persisted = persistEmojiLanguageSettings({ untouched: { value: 1 } }, valid);
  assert.deepEqual(readPersistedEmojiLanguageSettings(persisted), valid);
  assert.deepEqual((persisted as Record<string, unknown>).untouched, { value: 1 });
  clearAllEmojiLanguageLobbySettingsForTests();
  hydrateEmojiLanguageLobbySettings('room', persisted);
  assert.deepEqual(getEmojiLanguageLobbySettings('room'), valid);
});

test('player mode privately shows the writer answer and hides it from guessers and spectators', () => {
  const match = create();
  assert.equal(match.round.writerPlayerId, 'p1');
  const currentShell = shell(match, ['spectator']);
  assert.ok(buildEmojiLanguagePlayerView(match, 'p1', currentShell).privateAnswer);
  assert.equal(buildEmojiLanguagePlayerView(match, 'p2', currentShell).privateAnswer, null);
  const spectator = buildEmojiLanguagePlayerView(match, 'spectator', currentShell);
  assert.equal(spectator.privateAnswer, null);
  assert.equal(spectator.revealedAnswer, null);
  assert.equal(spectator.clue, null);
  assert.equal(spectator.isSpectator, true);
});

test('only the writer can submit one immutable clue made of 1-10 approved tokens', () => {
  const match = create();
  assert.equal(
    submitEmojiLanguageClue(match, 'p2', { roundId: match.round.roundId, emojis: ['😀'] }).ok,
    false,
  );
  assert.equal(
    submitEmojiLanguageClue(match, 'p1', { roundId: match.round.roundId, emojis: [] }).ok,
    false,
  );
  assert.equal(
    submitEmojiLanguageClue(match, 'p1', {
      roundId: match.round.roundId,
      emojis: ['😀', 'word'],
    }).ok,
    false,
  );
  const accepted = submitEmojiLanguageClue(
    match,
    'p1',
    { roundId: match.round.roundId, emojis: ['😀', '☕'] },
    2_000,
  );
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.deepEqual(accepted.match.round.clue, ['😀', '☕']);
  assert.equal(accepted.match.round.phase, 'guessing');
  assert.equal(
    submitEmojiLanguageClue(accepted.match, 'p1', {
      roundId: match.round.roundId,
      emojis: ['🔥'],
    }).ok,
    false,
  );
});

test('wrong attempts are repeatable after cooldown while first correct order is immutable', () => {
  const guessing = clue(create());
  const wrong = submitEmojiLanguageGuess(
    guessing,
    'p2',
    { roundId: guessing.round.roundId, answer: 'خطأ', requestId: 'request-wrong-1' },
    3_000,
  );
  assert.equal(wrong.ok && wrong.feedback.correct, false);
  if (!wrong.ok) return;
  const spam = submitEmojiLanguageGuess(
    wrong.match,
    'p2',
    {
      roundId: guessing.round.roundId,
      answer: guessing.round.answer,
      requestId: 'request-spam-2',
    },
    3_100,
  );
  assert.equal(spam.ok, false);
  const correct = submitEmojiLanguageGuess(
    wrong.match,
    'p2',
    {
      roundId: guessing.round.roundId,
      answer: guessing.round.acceptedAnswers[0]!,
      requestId: 'request-correct-3',
    },
    3_751,
  );
  assert.equal(correct.ok && correct.feedback.placement, 1);
  if (!correct.ok) return;
  const replay = submitEmojiLanguageGuess(
    correct.match,
    'p2',
    {
      roundId: guessing.round.roundId,
      answer: guessing.round.answer,
      requestId: 'request-correct-3',
    },
    4_600,
  );
  assert.equal(replay.ok && replay.changed, false);
  assert.equal(replay.ok && replay.feedback.placement, 1);
  assert.equal(
    submitEmojiLanguageGuess(
      correct.match,
      'p1',
      {
        roundId: guessing.round.roundId,
        answer: guessing.round.answer,
        requestId: 'writer-cannot-guess',
      },
      4_600,
    ).ok,
    false,
  );
});

test('all-correct does not end early and deadline scores placements plus writer exactly once', () => {
  let match = clue(create());
  const second = submitEmojiLanguageGuess(
    match,
    'p2',
    { roundId: match.round.roundId, answer: match.round.answer, requestId: 'correct-p2-a' },
    3_000,
  );
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const third = submitEmojiLanguageGuess(
    second.match,
    'p3',
    { roundId: match.round.roundId, answer: match.round.answer, requestId: 'correct-p3-b' },
    3_100,
  );
  assert.equal(third.ok, true);
  if (!third.ok) return;
  match = third.match;
  assert.equal(match.round.phase, 'guessing');
  const ended = expire(match, match.round.deadlineAtMs!);
  assert.equal(ended.scores.p2, 100);
  assert.equal(ended.scores.p3, 75);
  assert.equal(ended.scores.p1, 100);
  assert.equal(ended.round.scored, true);
  assert.equal(
    expireEmojiLanguagePhase(ended, match.round.roundId, 'guessing', match.round.deadlineAtMs! + 1),
    null,
  );
});

test('preparation timeout reveals normally with no clue and no points', () => {
  const match = create();
  const ended = expire(match, match.round.deadlineAtMs!);
  assert.equal(ended.round.phase, 'round-results');
  assert.equal(ended.round.resultReason, 'no-clue');
  assert.deepEqual(ended.scores, { p1: 0, p2: 0, p3: 0 });
  const guesserView = buildEmojiLanguagePlayerView(ended, 'p2', shell(ended));
  assert.equal(guesserView.revealedAnswer, match.round.answer);
  assert.equal(guesserView.clue, null);
});

test('writer rotation is stable and circular when rounds exceed participants', () => {
  let match = create('player-clue', ['p1', 'p2', 'p3']);
  const writers: Array<string | null> = [];
  for (let round = 1; round <= 5; round += 1) {
    writers.push(match.round.writerPlayerId);
    match = expire(match, match.round.deadlineAtMs!);
    if (round < 5) match = expire(match, match.round.deadlineAtMs!);
  }
  assert.deepEqual(writers, ['p1', 'p2', 'p3', 'p1', 'p2']);
  assert.equal(match.round.phase, 'round-results');
});

test('server mode starts with an authored clue, accepts aliases, and gives no writer points', () => {
  let match = create('server-puzzle');
  assert.equal(match.round.phase, 'guessing');
  assert.equal(match.round.writerPlayerId, null);
  assert.ok(match.round.clue?.length);
  const accepted = submitEmojiLanguageGuess(
    match,
    'p1',
    {
      roundId: match.round.roundId,
      answer: match.round.acceptedAnswers.at(-1)!,
      requestId: 'server-alias-ok',
    },
    2_000,
  );
  assert.equal(accepted.ok && accepted.feedback.correct, true);
  if (!accepted.ok) return;
  match = expire(accepted.match, accepted.match.round.deadlineAtMs!);
  assert.equal(match.scores.p1, 100);
  assert.equal(match.scores.p2, 0);
  assert.equal(match.scores.p3, 0);
});

test('reconnect view restores fixed clue, deadline, own status, and only writer secret', () => {
  let match = clue(create());
  const correct = submitEmojiLanguageGuess(
    match,
    'p2',
    { roundId: match.round.roundId, answer: match.round.answer, requestId: 'reconnect-correct' },
    3_000,
  );
  assert.equal(correct.ok, true);
  if (!correct.ok) return;
  match = correct.match;
  const currentShell = shell(match);
  const writer = buildEmojiLanguagePlayerView(match, 'p1', currentShell, 3_100);
  const guesser = buildEmojiLanguagePlayerView(match, 'p2', currentShell, 3_100);
  assert.deepEqual(writer.clue, ['😀', '☕']);
  assert.equal(writer.privateAnswer, match.round.answer);
  assert.equal(guesser.privateAnswer, null);
  assert.equal(guesser.ownCorrect, true);
  assert.equal(guesser.ownPlacement, 1);
  assert.equal(guesser.deadlineAtMs, match.round.deadlineAtMs);
});

test('permanent writer departure ends only that preparation; too few players ends match', () => {
  const match = create('player-clue', ['p1', 'p2', 'p3']);
  const left = handleEmojiLanguagePermanentLeave(match, 'p1', 2_000);
  assert.equal(left.round.phase, 'round-results');
  assert.equal(left.round.resultReason, 'no-clue');
  const next = expire(left, left.round.deadlineAtMs!);
  assert.equal(next.round.writerPlayerId, 'p2');
  const tooFew = handleEmojiLanguagePermanentLeave(next, 'p3', 20_000);
  assert.equal(tooFew.round.phase, 'completed');
  assert.equal(tooFew.round.resultReason, 'insufficient-players');
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
