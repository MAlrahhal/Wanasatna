import assert from 'node:assert/strict';
import type { GameShellState, TimelinePlacementSettings } from '@wanasatna/shared';
import { TIMELINE_PLACEMENT_DEFAULT_SETTINGS, TIMELINE_PLACEMENT_GAME_ID } from '@wanasatna/shared';
import {
  clearAllTimelinePlacementLobbySettingsForTests,
  getTimelinePlacementLobbySettings,
  hydrateTimelinePlacementLobbySettings,
  persistTimelinePlacementSettings,
  readPersistedTimelinePlacementSettings,
  validateTimelinePlacementSettings,
} from '../src/modules/game/experimental/timeline-placement/lobby-settings.js';
import {
  TIMELINE_PLACEMENT_EVENTS,
  validateTimelinePlacementContent,
} from '../src/modules/game/experimental/timeline-placement/provisional-content.js';
import {
  advanceTimelinePlacementAnswer,
  buildTimelineGaps,
  buildTimelinePlacementPlayerView,
  chooseTimelineGap,
  createTimelinePlacementMatch,
  expireTimelinePlacementPhase,
  handleTimelinePlacementPermanentLeave,
  resolveTimelineCorrectGapId,
  type TimelinePlacementMatchState,
} from '../src/modules/game/experimental/timeline-placement/state.js';

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

function settings(overrides: Partial<TimelinePlacementSettings> = {}): TimelinePlacementSettings {
  return { ...TIMELINE_PLACEMENT_DEFAULT_SETTINGS, ...overrides } as TimelinePlacementSettings;
}

function create(playerIds = ['p1', 'p2', 'p3'], now = 1_000) {
  return createTimelinePlacementMatch({
    playerIds,
    playerNames: Object.fromEntries(playerIds.map((id) => [id, id.toUpperCase()])),
    settings: settings(),
    random: () => 0,
    now,
  });
}

function shell(
  match: TimelinePlacementMatchState,
  hostPlayerId = match.playerIds[0]!,
  extraPlayerIds: string[] = [],
): GameShellState {
  const all = [...match.playerOrder, ...extraPlayerIds];
  return {
    shellId: 'shell',
    roomId: 'room',
    gameId: TIMELINE_PLACEMENT_GAME_ID,
    phase: 'PLAYING',
    hostPlayerId,
    players: all.map((id) => ({
      id,
      name: match.playerNames[id] ?? id,
      isHost: id === hostPlayerId,
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

function expire(match: TimelinePlacementMatchState, now: number): TimelinePlacementMatchState {
  const next = expireTimelinePlacementPhase(match, match.round.roundId, match.round.phase, now);
  assert.ok(next);
  return next!;
}

test('provisional bank has 14 sourced entries with unique stable IDs and years', () => {
  assert.equal(TIMELINE_PLACEMENT_EVENTS.length, 14);
  assert.deepEqual(validateTimelinePlacementContent(), []);
  assert.equal(new Set(TIMELINE_PLACEMENT_EVENTS.map((entry) => entry.id)).size, 14);
  assert.equal(new Set(TIMELINE_PLACEMENT_EVENTS.map((entry) => entry.year)).size, 14);
  assert.ok(TIMELINE_PLACEMENT_EVENTS.every((entry) => entry.sourceUrl.startsWith('https://')));
});

test('settings accept explicit options, reject extra claims, and persist beside room JSON', () => {
  const valid = settings({ roundCount: 12, selectionSeconds: 60 });
  assert.deepEqual(validateTimelinePlacementSettings(valid), { success: true, data: valid });
  assert.equal(validateTimelinePlacementSettings({ ...valid, isAdmin: true }).success, false);
  assert.equal(validateTimelinePlacementSettings({ ...valid, userId: 'u1' }).success, false);
  assert.equal(validateTimelinePlacementSettings({ ...valid, roundCount: 6 }).success, false);
  assert.equal(
    validateTimelinePlacementSettings({ ...valid, selectionSeconds: '60' }).success,
    false,
  );
  const persisted = persistTimelinePlacementSettings({ untouched: { value: 1 } }, valid);
  assert.deepEqual(readPersistedTimelinePlacementSettings(persisted), valid);
  assert.deepEqual((persisted as Record<string, unknown>).untouched, { value: 1 });
  clearAllTimelinePlacementLobbySettingsForTests();
  hydrateTimelinePlacementLobbySettings('room', persisted);
  assert.deepEqual(getTimelinePlacementLobbySettings('room'), valid);
});

test('match starts with two ordered anchors and reserves distinct events for all rounds', () => {
  const match = create();
  assert.equal(match.timeline.length, 2);
  assert.ok(match.timeline[0]!.year < match.timeline[1]!.year);
  assert.equal(match.queuedEvents.length, 7);
  assert.equal(match.usedEventIds.length, 9);
  assert.equal(new Set(match.usedEventIds).size, 9);
  assert.equal(
    new Set([...match.timeline, ...match.queuedEvents].map((entry) => entry.year)).size,
    9,
  );
});

test('server shuffle can produce different match event sets', () => {
  const first = createTimelinePlacementMatch({
    playerIds: ['p1', 'p2'],
    playerNames: { p1: 'P1', p2: 'P2' },
    settings: settings(),
    random: () => 0,
    now: 1_000,
  });
  const second = createTimelinePlacementMatch({
    playerIds: ['p1', 'p2'],
    playerNames: { p1: 'P1', p2: 'P2' },
    settings: settings(),
    random: () => 0.999_999,
    now: 1_000,
  });
  assert.notDeepEqual(first.usedEventIds, second.usedEventIds);
});

test('stable gap IDs cover beginning, every middle boundary, and end', () => {
  const gaps = buildTimelineGaps([{ id: 'old' }, { id: 'middle' }, { id: 'new' }]);
  assert.deepEqual(
    gaps.map((gap) => gap.id),
    ['before:old', 'between:old:middle', 'between:middle:new', 'after:new'],
  );
});

test('the authoritative correct gap resolves beginning, middle, and end placements', () => {
  const timeline = [
    { id: 'old', text: 'قديم', year: 2000, sourceUrl: 'https://example.com/old' },
    { id: 'new', text: 'جديد', year: 2010, sourceUrl: 'https://example.com/new' },
  ];
  assert.equal(
    resolveTimelineCorrectGapId(timeline, {
      id: 'before',
      text: 'قبل',
      year: 1990,
      sourceUrl: 'https://example.com/before',
    }),
    'before:old',
  );
  assert.equal(
    resolveTimelineCorrectGapId(timeline, {
      id: 'between',
      text: 'وسط',
      year: 2005,
      sourceUrl: 'https://example.com/between',
    }),
    'between:old:new',
  );
  assert.equal(
    resolveTimelineCorrectGapId(timeline, {
      id: 'after',
      text: 'بعد',
      year: 2020,
      sourceUrl: 'https://example.com/after',
    }),
    'after:new',
  );
});

test('2-15 participants choose simultaneously, may revise, and all-answer never ends early', () => {
  for (const count of [2, 15]) {
    let match = create(Array.from({ length: count }, (_, index) => `p${index + 1}`));
    const firstGap = match.round.gaps[0]!.id;
    const lastGap = match.round.gaps.at(-1)!.id;
    for (const playerId of match.playerIds) {
      const result = chooseTimelineGap(
        match,
        playerId,
        {
          roundId: match.round.roundId,
          gapId: firstGap,
        },
        match.round.deadlineAtMs! - 1,
      );
      assert.equal(result.ok, true);
      if (result.ok) match = result.match;
    }
    assert.equal(match.round.phase, 'selecting');
    assert.equal(Object.keys(match.round.choicesByPlayerId).length, count);
    const changed = chooseTimelineGap(
      match,
      match.playerIds[0]!,
      { roundId: match.round.roundId, gapId: lastGap },
      match.round.deadlineAtMs! - 1,
    );
    assert.equal(changed.ok && changed.match.round.choicesByPlayerId[match.playerIds[0]!], lastGap);
  }
});

test('late, stale, invalid, forged, and spectator choices are rejected', () => {
  const match = create();
  const validGap = match.round.gaps[0]!.id;
  assert.equal(chooseTimelineGap(match, 'p1', { roundId: 'stale', gapId: validGap }).ok, false);
  assert.equal(
    chooseTimelineGap(match, 'p1', { roundId: match.round.roundId, gapId: 'year:2024' }).ok,
    false,
  );
  assert.equal(
    chooseTimelineGap(
      match,
      'spectator',
      { roundId: match.round.roundId, gapId: validGap },
      match.round.deadlineAtMs! - 1,
    ).ok,
    false,
  );
  assert.equal(
    chooseTimelineGap(
      match,
      'p1',
      { roundId: match.round.roundId, gapId: validGap },
      match.round.deadlineAtMs!,
    ).ok,
    false,
  );
});

test('views keep candidate year, sources, other choices, and correctness private while selecting', () => {
  let match = create();
  const selected = chooseTimelineGap(
    match,
    'p1',
    {
      roundId: match.round.roundId,
      gapId: match.round.correctGapId,
    },
    match.round.deadlineAtMs! - 1,
  );
  assert.equal(selected.ok, true);
  if (selected.ok) match = selected.match;
  const currentShell = shell(match, 'p1', ['spectator']);
  const owner = buildTimelinePlacementPlayerView(match, 'p1', currentShell);
  const other = buildTimelinePlacementPlayerView(match, 'p2', currentShell);
  const spectator = buildTimelinePlacementPlayerView(match, 'spectator', currentShell);
  assert.equal(owner.ownGapId, match.round.correctGapId);
  assert.equal(other.ownGapId, null);
  assert.equal(other.placements.length, 0);
  assert.equal(other.revealedAnswer, null);
  assert.equal('year' in other.candidate!, false);
  assert.equal('sourceUrl' in other.candidate!, false);
  assert.equal(spectator.isSpectator, true);
  assert.equal(spectator.canChoose, false);
});

test('deadline reveals names before the answer, then correctness and the inserted year', () => {
  let match = create();
  for (const playerId of match.playerIds) {
    const selected = chooseTimelineGap(
      match,
      playerId,
      {
        roundId: match.round.roundId,
        gapId: match.round.correctGapId,
      },
      match.round.deadlineAtMs! - 1,
    );
    assert.equal(selected.ok, true);
    if (selected.ok) match = selected.match;
  }
  const beforeLength = match.timeline.length;
  match = expire(match, match.round.deadlineAtMs!);
  const namesView = buildTimelinePlacementPlayerView(match, 'p2', shell(match));
  assert.equal(namesView.phase, 'placements-reveal');
  assert.equal(namesView.placements.length, 3);
  assert.ok(namesView.placements.every((entry) => entry.isCorrect === null));
  assert.equal(namesView.revealedAnswer, null);
  assert.equal(namesView.timeline.length, beforeLength);

  match = expire(match, match.round.deadlineAtMs!);
  const answerView = buildTimelinePlacementPlayerView(match, 'p2', shell(match));
  assert.equal(answerView.phase, 'answer-reveal');
  assert.ok(answerView.placements.every((entry) => entry.isCorrect === true));
  assert.equal(answerView.revealedAnswer?.event.year, match.round.candidate.year);
  assert.equal(answerView.timeline.length, beforeLength + 1);
  assert.deepEqual(
    match.playerIds.map((id) => match.scores[id]),
    [100, 100, 100],
  );
});

test('scoring is idempotent, stale expiry cannot score twice, and ties remain joint winners', () => {
  let match = create(['p1', 'p2']);
  for (const playerId of match.playerIds) {
    const result = chooseTimelineGap(
      match,
      playerId,
      {
        roundId: match.round.roundId,
        gapId: match.round.correctGapId,
      },
      match.round.deadlineAtMs! - 1,
    );
    if (result.ok) match = result.match;
  }
  const roundId = match.round.roundId;
  match = expire(match, match.round.deadlineAtMs!);
  assert.equal(expireTimelinePlacementPhase(match, roundId, 'selecting', 99_999), null);
  assert.deepEqual(match.scores, { p1: 100, p2: 100 });
  match = expire(match, match.round.deadlineAtMs!);
  for (let round = 1; round < match.settings.roundCount; round += 1) {
    match = expire(match, match.round.deadlineAtMs!);
    for (const playerId of match.playerIds) {
      const result = chooseTimelineGap(
        match,
        playerId,
        {
          roundId: match.round.roundId,
          gapId: match.round.correctGapId,
        },
        match.round.deadlineAtMs! - 1,
      );
      if (result.ok) match = result.match;
    }
    match = expire(match, match.round.deadlineAtMs!);
    match = expire(match, match.round.deadlineAtMs!);
  }
  match = expire(match, match.round.deadlineAtMs!);
  const finalView = buildTimelinePlacementPlayerView(match, 'p1', shell(match));
  assert.equal(finalView.phase, 'completed');
  assert.deepEqual(finalView.winnerPlayerIds, ['p1', 'p2']);
  assert.equal(match.timeline.length, 9);
});

test('only current host advances answer reveal and timer/manual races converge safely', () => {
  let match = create();
  match = expire(match, match.round.deadlineAtMs!);
  match = expire(match, match.round.deadlineAtMs!);
  const roundId = match.round.roundId;
  assert.equal(advanceTimelinePlacementAnswer(match, 'p2', 'p1', { roundId }).ok, false);
  const advanced = advanceTimelinePlacementAnswer(match, 'p2', 'p2', { roundId }, 50_000);
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  assert.equal(advanced.match.currentRound, 2);
  assert.equal(
    expireTimelinePlacementPhase(advanced.match, roundId, 'answer-reveal', 99_999),
    null,
  );
});

test('reconnect restores own latest choice and host transfer changes controls, not match state', () => {
  let match = create();
  const gapId = match.round.gaps.at(-1)!.id;
  const chosen = chooseTimelineGap(
    match,
    'p2',
    { roundId: match.round.roundId, gapId },
    match.round.deadlineAtMs! - 1,
  );
  if (chosen.ok) match = chosen.match;
  const reconnected = buildTimelinePlacementPlayerView(match, 'p2', shell(match, 'p3'));
  assert.equal(reconnected.ownGapId, gapId);
  assert.equal(reconnected.deadlineAtMs, match.round.deadlineAtMs);
  assert.equal(reconnected.isHost, false);
  assert.deepEqual(reconnected.settings, match.settings);

  match = expire(match, match.round.deadlineAtMs!);
  match = expire(match, match.round.deadlineAtMs!);
  const transferred = buildTimelinePlacementPlayerView(match, 'p3', shell(match, 'p3'));
  assert.equal(transferred.canAdvance, true);
  assert.equal(transferred.currentRound, 1);
});

test('permanent departure preserves scores, completes below two, and disconnect needs no state change', () => {
  const match = create(['p1', 'p2', 'p3']);
  const departed = handleTimelinePlacementPermanentLeave(match, 'p3', 2_000);
  assert.deepEqual(departed.playerIds, ['p1', 'p2']);
  assert.equal(departed.scores.p3, 0);
  assert.equal(departed.round.phase, 'selecting');
  const insufficient = handleTimelinePlacementPermanentLeave(departed, 'p2', 3_000);
  assert.equal(insufficient.round.phase, 'completed');
  assert.equal(insufficient.round.resultReason, 'insufficient-players');
  assert.equal(match.round.deadlineAtMs, 31_000);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
