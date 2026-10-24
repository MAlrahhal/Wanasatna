import assert from 'node:assert/strict';
import type { DrawStroke, EyewitnessSettings, GameShellState } from '@wanasatna/shared';
import { EYEWITNESS_DEFAULT_SETTINGS, EYEWITNESS_GAME_ID } from '@wanasatna/shared';
import {
  getEyewitnessLobbySettings,
  hydrateEyewitnessLobbySettings,
  persistEyewitnessSettings,
  validateEyewitnessSettings,
} from '../src/modules/game/experimental/eyewitness/lobby-settings.js';
import {
  EYEWITNESS_IMAGE_BANK,
  validateEyewitnessImageBank,
} from '../src/modules/game/experimental/eyewitness/image-bank.js';
import {
  advanceEyewitnessRound,
  beginEyewitnessDrawing,
  buildEyewitnessPlayerView,
  confirmEyewitnessVote,
  createEyewitnessMatch,
  expireEyewitnessPhase,
  handleEyewitnessPermanentLeave,
  reconcileEyewitnessWitnessConnection,
  revealEyewitnessRound,
  submitEyewitnessArtwork,
  submitEyewitnessDescription,
  updateEyewitnessArtworkStrokes,
  updateEyewitnessDescription,
  type EyewitnessMatchState,
} from '../src/modules/game/experimental/eyewitness/state.js';

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

function settings(overrides: Partial<EyewitnessSettings> = {}): EyewitnessSettings {
  return { ...EYEWITNESS_DEFAULT_SETTINGS, ...overrides } as EyewitnessSettings;
}

function create(playerIds = ['p1', 'p2', 'p3', 'p4'], now = 1_000) {
  return createEyewitnessMatch({
    playerIds,
    playerNames: Object.fromEntries(playerIds.map((id) => [id, id.toUpperCase()])),
    settings: settings(),
    random: () => 0,
    now,
  });
}

function shell(
  match: EyewitnessMatchState,
  hostPlayerId = 'p1',
  extraIds: string[] = [],
): GameShellState {
  const ids = [...match.playerIds, ...extraIds.filter((id) => !match.playerIds.includes(id))];
  return {
    shellId: 'shell',
    roomId: 'room',
    gameId: EYEWITNESS_GAME_ID,
    phase: 'PLAYING',
    hostPlayerId,
    players: ids.map((id) => ({
      id,
      name: match.playerNames[id] ?? id.toUpperCase(),
      isHost: id === hostPlayerId,
      isConnected: true,
      isReady: true,
      isSpectator: !match.playerIds.includes(id),
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

const sampleStroke: DrawStroke = {
  id: 'stroke-1',
  tool: 'draw',
  color: '#111827',
  size: 8,
  points: [
    { x: 10, y: 20 },
    { x: 30, y: 40 },
  ],
};

test('provisional image bank has fifteen distinct available bounded assets', () => {
  assert.equal(EYEWITNESS_IMAGE_BANK.length, 15);
  assert.equal(new Set(EYEWITNESS_IMAGE_BANK.map((entry) => entry.id)).size, 15);
  assert.deepEqual(validateEyewitnessImageBank(), {
    count: 15,
    duplicateIds: [],
    missingFiles: [],
    invalidSizes: [],
    invalidDimensions: [],
  });
});

test('settings accept only exact provisional values and preserve unrelated JSON', () => {
  const valid = settings({
    roundCount: 7,
    descriptionSeconds: 120,
    drawingSeconds: 45,
    votingSeconds: 30,
  });
  assert.deepEqual(validateEyewitnessSettings(valid), { success: true, data: valid });
  assert.equal(validateEyewitnessSettings({ ...valid, userId: 'forged' }).success, false);
  assert.equal(validateEyewitnessSettings({ ...valid, isAdmin: true }).success, false);
  assert.equal(validateEyewitnessSettings({ ...valid, roundCount: 6 }).success, false);
  assert.equal(validateEyewitnessSettings({ ...valid, drawingSeconds: '60' }).success, false);
  const persisted = persistEyewitnessSettings({ untouched: 1 }, valid);
  hydrateEyewitnessLobbySettings('room', persisted);
  assert.deepEqual(getEyewitnessLobbySettings('room'), valid);
  assert.equal((persisted as Record<string, unknown>).untouched, 1);
});

test('initial witness and image are authoritative and the private projection is role scoped', () => {
  const match = create();
  const witness = match.round.witnessPlayerId;
  const artist = match.round.artistPlayerIds[0]!;
  const witnessView = buildEyewitnessPlayerView(match, witness, shell(match));
  const artistView = buildEyewitnessPlayerView(match, artist, shell(match));
  const spectatorView = buildEyewitnessPlayerView(match, 'late', shell(match, 'p1', ['late']));
  assert.match(witnessView.privateReferenceImageDataUrl ?? '', /^data:image\/jpeg;base64,/);
  assert.equal(artistView.privateReferenceImageDataUrl, null);
  assert.equal(spectatorView.privateReferenceImageDataUrl, null);
  assert.equal(artistView.lockedDescription, null);
  assert.equal(JSON.stringify(artistView).includes(match.round.imageId), false);
  assert.equal(JSON.stringify(spectatorView).includes('data:image'), false);
});

test('witness draft is private, accepts empty explicit submission, and locks immediately', () => {
  let match = create();
  const witness = match.round.witnessPlayerId;
  const saved = updateEyewitnessDescription(
    match,
    witness,
    { roundId: match.round.roundId, description: 'مخلوق أزرق بثلاث عيون' },
    2_000,
  );
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  match = saved.match;
  const artist = match.round.artistPlayerIds[0]!;
  assert.equal(buildEyewitnessPlayerView(match, artist, shell(match)).ownDescriptionDraft, null);
  const submitted = submitEyewitnessDescription(
    match,
    witness,
    { roundId: match.round.roundId, description: '' },
    3_000,
  );
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  assert.equal(submitted.match.round.phase, 'drawing');
  assert.equal(submitted.match.round.lockedDescription, '');
  assert.equal(
    buildEyewitnessPlayerView(submitted.match, witness, shell(submitted.match))
      .privateReferenceImageDataUrl,
    null,
  );
  assert.equal(
    updateEyewitnessDescription(submitted.match, witness, {
      roundId: match.round.roundId,
      description: 'late',
    }).ok,
    false,
  );
});

test('description timeout locks the current draft including a completely empty one', () => {
  const match = create();
  const expired = expireEyewitnessPhase(
    match,
    match.round.roundId,
    'witness',
    match.round.deadlineAtMs!,
  );
  assert.ok(expired);
  assert.equal(expired?.round.phase, 'drawing');
  assert.equal(expired?.round.lockedDescription, '');
});

test('temporary witness disconnect pauses and reconnect resumes exact remaining time', () => {
  let match = create();
  match = reconcileEyewitnessWitnessConnection(match, false, 20_000);
  assert.equal(match.round.deadlineAtMs, null);
  assert.equal(match.round.pausedWitnessRemainingMs, 71_000);
  assert.equal(expireEyewitnessPhase(match, match.round.roundId, 'witness', 200_000), null);
  match = reconcileEyewitnessWitnessConnection(match, true, 30_000);
  assert.equal(match.round.deadlineAtMs, 101_000);
});

test('witness permanent leave before locking produces no fabricated artwork or winner', () => {
  const match = create();
  const next = handleEyewitnessPermanentLeave(match, match.round.witnessPlayerId, 2_000);
  assert.equal(next.round.phase, 'round-results');
  assert.equal(next.round.resultReason, 'witness-left');
  assert.deepEqual(next.round.artworkOrder, []);
  assert.deepEqual(next.round.roundWinnerArtworkIds, []);
  assert.deepEqual(buildEyewitnessPlayerView(next, 'p2', shell(next)).resultArtworks, []);
});

test('artists own independent server drawings and all submissions end drawing early including blanks', () => {
  let match = beginEyewitnessDrawing(create(), 2_000);
  const artists = match.round.artistPlayerIds;
  match = updateEyewitnessArtworkStrokes(match, artists[0]!, [sampleStroke]);
  assert.equal(match.round.artworksByPlayerId[artists[0]!]!.strokes.length, 1);
  assert.deepEqual(match.round.artworksByPlayerId[artists[1]!]!.strokes, []);
  for (const artist of artists) {
    const result = submitEyewitnessArtwork(match, artist, match.round.roundId, 3_000);
    assert.equal(result.ok, true);
    if (result.ok) match = result.match;
  }
  assert.equal(match.round.phase, 'voting');
  assert.equal(match.round.artworkOrder.length, artists.length);
  assert.ok(
    Object.values(match.round.artworksByPlayerId).some((artwork) => artwork.strokes.length === 0),
  );
});

test('artist reconnect restores only their board and an artist disconnect never pauses drawing', () => {
  let match = beginEyewitnessDrawing(create(), 2_000);
  const artist = match.round.artistPlayerIds[0]!;
  match = updateEyewitnessArtworkStrokes(match, artist, [sampleStroke]);
  match = reconcileEyewitnessWitnessConnection(match, false, 3_000);
  assert.equal(match.round.deadlineAtMs, 62_000);
  const restored = buildEyewitnessPlayerView(match, artist, shell(match));
  assert.equal(restored.ownStrokes.length, 1);
  const other = buildEyewitnessPlayerView(match, match.round.artistPlayerIds[1]!, shell(match));
  assert.equal(other.ownStrokes.length, 0);
  assert.equal(JSON.stringify(other).includes('stroke-1'), false);
});

function enterVoting(match: EyewitnessMatchState): EyewitnessMatchState {
  const expired = expireEyewitnessPhase(
    match,
    match.round.roundId,
    'drawing',
    match.round.deadlineAtMs!,
  );
  assert.ok(expired);
  return expired!;
}

test('voting rejects self, spectator, forged, stale and late votes while allowing vote changes', () => {
  let match = enterVoting(beginEyewitnessDrawing(create(), 2_000));
  const artist = match.round.artistPlayerIds[0]!;
  const own = match.round.artworksByPlayerId[artist]!.artworkId;
  const otherIds = match.round.artworkOrder.filter((id) => id !== own);
  assert.equal(
    confirmEyewitnessVote(match, artist, { roundId: match.round.roundId, artworkId: own }).ok,
    false,
  );
  assert.equal(
    confirmEyewitnessVote(match, 'late', { roundId: match.round.roundId, artworkId: otherIds[0]! })
      .ok,
    false,
  );
  assert.equal(
    confirmEyewitnessVote(match, artist, { roundId: 'stale', artworkId: otherIds[0]! }).ok,
    false,
  );
  assert.equal(
    confirmEyewitnessVote(match, artist, { roundId: match.round.roundId, artworkId: 'forged' }).ok,
    false,
  );
  let result = confirmEyewitnessVote(
    match,
    artist,
    { roundId: match.round.roundId, artworkId: otherIds[0]! },
    match.round.deadlineAtMs! - 2,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  match = result.match;
  result = confirmEyewitnessVote(
    match,
    artist,
    { roundId: match.round.roundId, artworkId: otherIds[1]! },
    match.round.deadlineAtMs! - 1,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.match.round.votesByPlayerId[artist], otherIds[1]);
  assert.equal(
    confirmEyewitnessVote(
      result.match,
      artist,
      { roundId: match.round.roundId, artworkId: otherIds[0]! },
      match.round.deadlineAtMs!,
    ).ok,
    false,
  );
  assert.equal(result.match.round.phase, 'voting');
});

test('voting projection is anonymous and never reveals live totals or other votes', () => {
  let match = enterVoting(beginEyewitnessDrawing(create(), 2_000));
  const voter = match.round.witnessPlayerId;
  const target = match.round.artworkOrder[0]!;
  const result = confirmEyewitnessVote(
    match,
    voter,
    { roundId: match.round.roundId, artworkId: target },
    64_000,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  match = result.match;
  const view = buildEyewitnessPlayerView(match, voter, shell(match));
  assert.equal(view.anonymousArtworks.length, match.round.artistPlayerIds.length);
  assert.equal(JSON.stringify(view.anonymousArtworks).includes('artistPlayerId'), false);
  assert.equal(JSON.stringify(view).includes('votesByPlayerId'), false);
  assert.equal(view.resultArtworks.length, 0);
  assert.equal(view.confirmedArtworkId, target);
});

test('positive top ties each earn one win and voter identities are absent from results', () => {
  let match = enterVoting(beginEyewitnessDrawing(create(), 2_000));
  const [a, b] = match.round.artworkOrder;
  const secondVoter = match.round.artistPlayerIds.find(
    (playerId) => match.round.artworksByPlayerId[playerId]!.artworkId !== b,
  )!;
  for (const [voter, artworkId] of [
    [match.round.witnessPlayerId, a],
    [secondVoter, b],
  ] as const) {
    const result = confirmEyewitnessVote(
      match,
      voter,
      { roundId: match.round.roundId, artworkId: artworkId! },
      64_000,
    );
    assert.equal(result.ok, true);
    if (result.ok) match = result.match;
  }
  match = revealEyewitnessRound(match, 'voting-complete', 130_000);
  assert.deepEqual(new Set(match.round.roundWinnerArtworkIds), new Set([a, b]));
  const view = buildEyewitnessPlayerView(match, 'p1', shell(match));
  assert.equal(view.resultArtworks.filter((artwork) => artwork.isRoundWinner).length, 2);
  assert.equal(
    view.resultArtworks.reduce((sum, artwork) => sum + artwork.voteCount, 0),
    2,
  );
  assert.equal(JSON.stringify(view).includes('votesByPlayerId'), false);
});

test('no valid votes yields no round winner', () => {
  const match = revealEyewitnessRound(
    enterVoting(beginEyewitnessDrawing(create(), 2_000)),
    'voting-complete',
    130_000,
  );
  assert.deepEqual(match.round.roundWinnerArtworkIds, []);
  assert.ok(Object.values(match.scores).every((score) => score === 0));
});

test('witness rotation is fair and all fifteen images remain unique within a fifteen-round match', () => {
  const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5'];
  let match = createEyewitnessMatch({
    playerIds,
    playerNames: Object.fromEntries(playerIds.map((id) => [id, id])),
    settings: settings({ roundCount: 15 }),
    random: () => 0,
    now: 1_000,
  });
  const firstCycle: string[] = [];
  for (let round = 1; round <= 15; round += 1) {
    if (round <= playerIds.length) firstCycle.push(match.round.witnessPlayerId);
    match = revealEyewitnessRound(
      beginEyewitnessDrawing(match, round * 1_000),
      'voting-complete',
      round * 1_000 + 1,
    );
    if (round < 15) {
      const advanced = advanceEyewitnessRound(
        match,
        playerIds.map((playerId) => ({ playerId, name: playerId })),
        `request-${round}`.padEnd(10, 'x'),
        round * 1_000 + 2,
        () => 0,
      );
      assert.equal(advanced.ok, true);
      if (advanced.ok) match = advanced.match;
    }
  }
  assert.equal(new Set(firstCycle).size, playerIds.length);
  assert.equal(match.usedImageIds.length, 15);
  assert.equal(new Set(match.usedImageIds).size, 15);
});

test('late joiner is absent in the active round then joins the next witness queue fairly', () => {
  let match = revealEyewitnessRound(
    beginEyewitnessDrawing(create(), 2_000),
    'voting-complete',
    3_000,
  );
  const advanced = advanceEyewitnessRound(
    match,
    [
      ...match.playerIds.map((playerId) => ({ playerId, name: playerId })),
      { playerId: 'late', name: 'Late' },
    ],
    'request-late',
    4_000,
    () => 0,
    ['late'],
  );
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  match = advanced.match;
  assert.ok(match.playerIds.includes('late'));
  assert.ok(match.witnessQueue.includes('late') || match.round.witnessPlayerId === 'late');
});

test('host transfer changes only next-button authority and does not alter active match state', () => {
  const match = revealEyewitnessRound(
    enterVoting(beginEyewitnessDrawing(create(), 2_000)),
    'voting-complete',
    130_000,
  );
  const before = JSON.stringify(match);
  assert.equal(buildEyewitnessPlayerView(match, 'p1', shell(match, 'p1')).canAdvance, true);
  assert.equal(buildEyewitnessPlayerView(match, 'p1', shell(match, 'p2')).canAdvance, false);
  assert.equal(buildEyewitnessPlayerView(match, 'p2', shell(match, 'p2')).canAdvance, true);
  assert.equal(JSON.stringify(match), before);
});

test('falling below three finishes the current result then completes before another round', () => {
  let match = create(['p1', 'p2', 'p3']);
  match = handleEyewitnessPermanentLeave(beginEyewitnessDrawing(match, 2_000), 'p3', 3_000);
  match = revealEyewitnessRound(enterVoting(match), 'insufficient-players', 130_000);
  const advanced = advanceEyewitnessRound(
    match,
    match.playerIds.map((playerId) => ({ playerId, name: playerId })),
    'request-end',
    140_000,
  );
  assert.equal(advanced.ok, true);
  if (advanced.ok) assert.equal(advanced.match.round.phase, 'completed');
});

console.log(`\nEyewitness unit tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
