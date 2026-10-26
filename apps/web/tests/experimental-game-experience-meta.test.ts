import assert from 'node:assert/strict';
import type {
  EmojiLanguagePlayerView,
  EyewitnessPlayerView,
  MostLikelyToPlayerView,
  OneWordOnlyPlayerView,
  SecretAgentsPlayerView,
  TimelinePlacementPlayerView,
} from '@wanasatna/shared';
import {
  emojiLanguageExperienceMeta,
  eyewitnessExperienceMeta,
  mostLikelyToExperienceMeta,
  oneWordOnlyExperienceMeta,
  secretAgentsExperienceMeta,
  timelinePlacementExperienceMeta,
} from '../lib/game/experimental-game-experience';

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

test('all six experimental games expose real phase, round, and timer state to the shared shell', () => {
  const deadlineAtMs = 123_456;
  const secret = secretAgentsExperienceMeta({
    phase: 'guessing',
    activeTeam: 'red',
    turnNumber: 3,
    deadlineAtMs,
    recoveryDeadlineAtMs: null,
  } as SecretAgentsPlayerView);
  const social = mostLikelyToExperienceMeta({
    phase: 'voting',
    questionNumber: 4,
    totalQuestions: 10,
    deadlineAtMs,
    aggregate: null,
    result: null,
  } as MostLikelyToPlayerView);
  const emoji = emojiLanguageExperienceMeta({
    phase: 'guessing',
    writerName: 'ليان',
    currentRound: 2,
    totalRounds: 5,
    deadlineAtMs,
    leaderboard: [],
  } as unknown as EmojiLanguagePlayerView);
  const timeline = timelinePlacementExperienceMeta({
    phase: 'selecting',
    currentRound: 2,
    totalRounds: 7,
    deadlineAtMs,
    leaderboard: [],
  } as unknown as TimelinePlacementPlayerView);
  const oneWord = oneWordOnlyExperienceMeta({
    phase: 'clue-writing',
    guesserName: 'راشد',
    currentRound: 2,
    totalRounds: 5,
    deadlineAtMs,
  } as OneWordOnlyPlayerView);
  const eyewitness = eyewitnessExperienceMeta({
    phase: 'drawing',
    witnessName: 'نور',
    currentRound: 2,
    totalRounds: 5,
    deadlineAtMs,
    leaderboard: [],
  } as unknown as EyewitnessPlayerView);

  for (const meta of [secret, social, emoji, timeline, oneWord, eyewitness]) {
    assert.equal(meta.timer?.deadlineAtMs, deadlineAtMs);
    assert.ok(meta.phaseLabel);
    assert.ok(meta.gameName);
  }
  assert.deepEqual([social.currentRound, social.totalRounds], [4, 10]);
  assert.equal(oneWord.centerLabel, 'المخمّن: راشد');
  assert.equal(eyewitness.centerLabel, 'شاهد الجولة: نور');
});

test('shared shell mapping exposes public scores but never copies private answers or role keys', () => {
  const emoji = emojiLanguageExperienceMeta({
    phase: 'guessing',
    selfPlayerId: 'p1',
    writerName: 'ليان',
    privateAnswer: 'سر خاص',
    currentRound: 1,
    totalRounds: 3,
    deadlineAtMs: null,
    leaderboard: [
      { playerId: 'p1', name: 'ليان', score: 200 },
      { playerId: 'p2', name: 'سارة', score: 100 },
    ],
  } as EmojiLanguagePlayerView);
  const secret = secretAgentsExperienceMeta({
    phase: 'clue',
    activeTeam: 'blue',
    turnNumber: 1,
    deadlineAtMs: null,
    recoveryDeadlineAtMs: null,
    secretKey: { card: 'assassin' },
  } as unknown as SecretAgentsPlayerView);

  assert.deepEqual(
    emoji.leaderboardEntries?.map((entry) => [entry.name, entry.score, entry.isCurrentPlayer]),
    [
      ['ليان', 200, true],
      ['سارة', 100, false],
    ],
  );
  assert.doesNotMatch(JSON.stringify(emoji), /سر خاص/);
  assert.doesNotMatch(JSON.stringify(secret), /assassin|secretKey/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
