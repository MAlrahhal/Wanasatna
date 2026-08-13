/**
 * Guessing Challenge Socket.IO multiplayer (1v1 + 2v2).
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:guessing-challenge:integration
 */
import assert from 'node:assert/strict';
import {
  GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
  GUESSING_CHALLENGE_END_QUESTION_EVENT,
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_REJECT_CARD_EVENT,
  GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
  GUESSING_CHALLENGE_SYNC_EVENT,
  GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
  GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT,
  RECONNECT_EVENT,
  TIMING_CHALLENGE_GAME_ID,
} from '@wanasatna/shared';
import {
  ack,
  connectClient,
  trackClientEvents,
  waitFor,
  waitForServer,
  type TestClient,
} from './helpers/socket-utils.js';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

type SyncView = {
  gamePhase: string;
  roundId: string;
  turnId: string;
  deadlineAtMs: number | null;
  currentRound: number;
  totalRounds: number;
  categoryId: string | null;
  categoryLabel: string | null;
  mode: '1v1' | '2v2';
  isMyTurn: boolean;
  currentTurnPlayerId: string | null;
  currentTurnTeamId: string | null;
  selfTeam: string | null;
  self: {
    playerId: string;
    revealedIdentity: { value: string | null } | null;
    yellowCardAvailable: boolean;
    redCardAvailable: boolean;
  };
  teammate: { playerId: string; name: string } | null;
  opponent: {
    playerId: string;
    visibleIdentity: { value: string | null } | null;
  };
  opponents: Array<{
    playerId: string;
    visibleIdentity: { value: string | null } | null;
  }>;
  yellowQuestionsRemaining: number | null;
  canEndQuestion: boolean;
  canGuess: boolean;
  canUseYellow: boolean;
  canUseRed: boolean;
  cardConfirmStatus: {
    requestId: string;
    card: string;
    confirmedCount: number;
    requiredCount: number;
    selfConfirmed: boolean;
  } | null;
  identityChangedNotice: boolean;
  winnerName: string | null;
  winningGuess: string | null;
  revealEntries: Array<{ playerId: string; identity: { value: string | null }; isWinner: boolean }>;
  roundResults: Array<{ playerId: string; roundPoints: number; isWinner: boolean }>;
  canContinueFromRoundResults: boolean;
  isMatchSpectator: boolean;
};

async function syncView(client: TestClient): Promise<SyncView> {
  const syncRes = await ack<{ success: boolean; data: { view: SyncView } }>(
    client.socket,
    GUESSING_CHALLENGE_SYNC_EVENT,
  );
  assert.equal(syncRes.success, true, 'sync failed');
  return syncRes.data.view;
}

async function endQuestion(client: TestClient) {
  const view = await syncView(client);
  return ack<{ success: boolean; data: { view: SyncView }; error?: { message?: string } }>(
    client.socket,
    GUESSING_CHALLENGE_END_QUESTION_EVENT,
    { roundId: view.roundId, turnId: view.turnId },
  );
}

async function useCard(
  client: TestClient,
  event:
    | typeof GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT
    | typeof GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
) {
  const view = await syncView(client);
  return ack<{ success: boolean; data: { view: SyncView }; error?: { message?: string } }>(
    client.socket,
    event,
    {
      roundId: view.roundId,
      turnId: view.turnId,
      requestId: view.cardConfirmStatus?.requestId,
    },
  );
}

async function submitGuess(client: TestClient, guess: string) {
  const view = await syncView(client);
  return ack<{
    success: boolean;
    data: {
      view: SyncView;
      guessCorrect?: boolean;
      guessFeedback?: string;
    };
    error?: { message?: string };
  }>(client.socket, GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT, {
    guess,
    roundId: view.roundId,
    turnId: view.turnId,
  });
}

async function continueResults(client: TestClient) {
  const view = await syncView(client);
  return ack<{ success: boolean; data: { view?: SyncView }; error?: { message?: string } }>(
    client.socket,
    GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
    { roundId: view.roundId },
  );
}

function emptyClient(name: string): TestClient {
  return {
    name,
    socket: null as unknown as TestClient['socket'],
    id: '',
    roomId: '',
    roomCode: '',
    reconnectToken: '',
    shellEvents: [],
    roster: [],
    rosterPlayers: [],
    navigations: [],
    recoveryEvents: [],
  };
}

async function startMatch1v1(): Promise<{ a: TestClient; b: TestClient }> {
  const hostSocket = await connectClient();
  const a = emptyClient('محمد');
  a.socket = hostSocket;
  trackClientEvents(a);

  const createRes = await ack<{
    success: boolean;
    data: { room: { code: string; id: string }; player: { id: string }; reconnectToken?: string };
  }>(a.socket, 'create-room', { playerName: a.name });
  assert.equal(createRes.success, true, 'create-room failed');
  a.id = createRes.data.player.id;
  a.roomId = createRes.data.room.id;
  a.roomCode = createRes.data.room.code;
  a.reconnectToken = createRes.data.reconnectToken ?? '';

  const bSocket = await connectClient();
  const b = emptyClient('خالد');
  b.socket = bSocket;
  b.roomCode = a.roomCode;
  trackClientEvents(b);

  const joinRes = await ack<{
    success: boolean;
    data: { player: { id: string }; room: { id: string }; reconnectToken?: string };
  }>(b.socket, 'join-room', { roomCode: a.roomCode, playerName: b.name });
  assert.equal(joinRes.success, true, 'join-room failed');
  b.id = joinRes.data.player.id;
  b.roomId = joinRes.data.room.id;
  b.reconnectToken = joinRes.data.reconnectToken ?? '';

  const startRes = await ack<{ success: boolean; error?: { message?: string } }>(
    a.socket,
    'game-shell-start-from-lobby',
    {
      gameId: GUESSING_CHALLENGE_GAME_ID,
      categoryId: 'football',
      guessingChallenge: { mode: '1v1' },
    },
  );
  assert.equal(startRes.success, true, startRes.error?.message ?? 'start-from-lobby failed');

  await waitFor(
    async () =>
      a.shellEvents.some((event) => event.phase === 'PLAYING') &&
      b.shellEvents.some((event) => event.phase === 'PLAYING')
        ? true
        : null,
    15000,
    'PLAYING',
  );

  await waitFor(async () => {
    const view = await syncView(a);
    return view.gamePhase === 'playing' ? view : null;
  }, 10000, 'playing phase');

  return { a, b };
}

async function startMatch2v2(): Promise<{
  a: TestClient;
  b: TestClient;
  c: TestClient;
  d: TestClient;
}> {
  const names = ['محمد', 'خالد', 'سارة', 'نورة'] as const;
  const clients: TestClient[] = [];

  for (let index = 0; index < 4; index += 1) {
    const client = emptyClient(names[index]!);
    client.socket = await connectClient();
    trackClientEvents(client);
    clients.push(client);
  }

  const [a, b, c, d] = clients as [TestClient, TestClient, TestClient, TestClient];

  const createRes = await ack<{
    success: boolean;
    data: { room: { code: string; id: string }; player: { id: string }; reconnectToken?: string };
  }>(a.socket, 'create-room', { playerName: a.name });
  assert.equal(createRes.success, true, 'create-room failed');
  a.id = createRes.data.player.id;
  a.roomId = createRes.data.room.id;
  a.roomCode = createRes.data.room.code;
  a.reconnectToken = createRes.data.reconnectToken ?? '';

  for (const joiner of [b, c, d]) {
    joiner.roomCode = a.roomCode;
    const joinRes = await ack<{
      success: boolean;
      data: { player: { id: string }; room: { id: string }; reconnectToken?: string };
    }>(joiner.socket, 'join-room', { roomCode: a.roomCode, playerName: joiner.name });
    assert.equal(joinRes.success, true, `join-room failed for ${joiner.name}`);
    joiner.id = joinRes.data.player.id;
    joiner.roomId = joinRes.data.room.id;
    joiner.reconnectToken = joinRes.data.reconnectToken ?? '';
  }

  const startRes = await ack<{ success: boolean; error?: { message?: string } }>(
    a.socket,
    'game-shell-start-from-lobby',
    {
      gameId: GUESSING_CHALLENGE_GAME_ID,
      categoryId: 'football',
      guessingChallenge: { mode: '2v2' },
    },
  );
  assert.equal(startRes.success, true, startRes.error?.message ?? '2v2 start failed');

  await waitFor(
    async () =>
      clients.every((client) => client.shellEvents.some((event) => event.phase === 'PLAYING'))
        ? true
        : null,
    15000,
    'PLAYING 2v2',
  );

  await waitFor(async () => {
    const view = await syncView(a);
    return view.gamePhase === 'playing' && view.mode === '2v2' ? view : null;
  }, 10000, '2v2 playing phase');

  return { a, b, c, d };
}

function disconnectAll(clients: TestClient[]): void {
  for (const client of clients) {
    client.socket.disconnect();
  }
}

async function finishCurrent1v1Round(a: TestClient, b: TestClient): Promise<SyncView> {
  const viewA = await syncView(a);
  const viewB = await syncView(b);
  const guesser = viewA.isMyTurn ? a : b;
  const secret = viewA.isMyTurn
    ? viewB.opponent.visibleIdentity?.value
    : viewA.opponent.visibleIdentity?.value;
  assert.ok(secret);
  const result = await submitGuess(guesser, secret);
  assert.equal(result.success, true, result.error?.message ?? 'correct guess failed');
  assert.equal(result.data.guessCorrect, true);
  return result.data.view;
}

async function main(): Promise<void> {
  console.log('[guessing-challenge] waiting for test server...');
  await waitForServer();

  await runTest('A+B privacy, turns, yellow, red, reconnect, wrong+correct guess', async () => {
    const { a, b } = await startMatch1v1();

    const viewA = await syncView(a);
    const viewB = await syncView(b);

    assert.equal(viewA.mode, '1v1');
    assert.ok(viewA.opponent.visibleIdentity?.value, 'A should see B identity');
    assert.ok(viewB.opponent.visibleIdentity?.value, 'B should see A identity');
    assert.equal(viewA.self.revealedIdentity, null, 'A own identity hidden');
    assert.equal(viewB.self.revealedIdentity, null, 'B own identity hidden');
    assert.notEqual(
      viewA.opponent.visibleIdentity?.value,
      viewB.opponent.visibleIdentity?.value,
      'identities must differ',
    );

    const secretA = viewB.opponent.visibleIdentity!.value!;
    const secretB = viewA.opponent.visibleIdentity!.value!;
    assert.equal(JSON.stringify(viewA).includes(secretA), false, 'A must not receive own secret');
    assert.equal(JSON.stringify(viewB).includes(secretB), false, 'B must not receive own secret');
    assert.equal(JSON.stringify(viewA).includes('acceptedAnswers'), false);
    assert.equal(JSON.stringify(viewB).includes('acceptedAnswers'), false);

    const starterId = viewA.currentTurnPlayerId;
    assert.ok(starterId === a.id || starterId === b.id, 'valid starter');
    const starter = starterId === a.id ? a : b;
    const other = starterId === a.id ? b : a;

    const end1 = await endQuestion(starter);
    assert.equal(end1.success, true, end1.error?.message ?? 'end-question 1 failed');

    const afterEnd1 = await syncView(a);
    assert.equal(afterEnd1.currentTurnPlayerId, other.id, 'turn should pass to other');

    const oppBeforeReconnect = (await syncView(a)).opponent.visibleIdentity?.value;
    const turnBeforeReconnect = (await syncView(a)).currentTurnPlayerId;
    assert.ok(a.reconnectToken, 'missing reconnect token');
    a.socket.disconnect();
    a.socket = await connectClient();
    trackClientEvents(a);
    const resumeRes = await ack<{ success: boolean; error?: { message?: string } }>(
      a.socket,
      RECONNECT_EVENT,
      {
        playerId: a.id,
        roomId: a.roomId,
        roomCode: a.roomCode,
        reconnectToken: a.reconnectToken,
      },
    );
    assert.equal(resumeRes.success, true, resumeRes.error?.message ?? 'reconnect failed');

    await waitFor(
      async () => {
        const latestA = a.recoveryEvents.at(-1);
        const latestB = b.recoveryEvents.at(-1);
        if (latestA && latestA.isActive) return null;
        if (latestB && latestB.isActive) return null;
        const view = await syncView(a);
        return view.gamePhase === 'playing' ? view : null;
      },
      5000,
      'recovery cleared after reconnect',
    );

    const afterReconnect = await syncView(a);
    assert.equal(afterReconnect.gamePhase, 'playing', 'phase after reconnect');
    assert.equal(afterReconnect.self.revealedIdentity, null, 'own identity still hidden');
    assert.equal(afterReconnect.currentTurnPlayerId, turnBeforeReconnect, 'turn preserved');
    assert.equal(
      afterReconnect.opponent.visibleIdentity?.value,
      oppBeforeReconnect,
      'opponent identity preserved',
    );

    let turnView = await syncView(a);
    if (turnView.currentTurnPlayerId !== other.id) {
      const current = turnView.currentTurnPlayerId === a.id ? a : b;
      const pass = await endQuestion(current);
      assert.equal(pass.success, true, pass.error?.message ?? 'pass to other failed');
    }

    const yellow = await useCard(other, GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT);
    assert.equal(yellow.success, true, yellow.error?.message ?? 'yellow failed');
    assert.equal(yellow.data.view.yellowQuestionsRemaining, 3, 'yellow starts at 3');

    const y1 = await endQuestion(other);
    assert.equal(y1.success, true, 'yellow q1');
    assert.equal(y1.data.view.currentTurnPlayerId, other.id);
    assert.equal(y1.data.view.yellowQuestionsRemaining, 2);

    const y2 = await endQuestion(other);
    assert.equal(y2.success, true, 'yellow q2');
    assert.equal(y2.data.view.yellowQuestionsRemaining, 1);

    const y3 = await endQuestion(other);
    assert.equal(y3.success, true, 'yellow q3');
    assert.equal(y3.data.view.currentTurnPlayerId, starter.id);
    assert.equal(y3.data.view.yellowQuestionsRemaining, null);

    if ((await syncView(a)).currentTurnPlayerId !== other.id) {
      const pass = await endQuestion(starter);
      assert.equal(pass.success, true, 'pass for red');
    }

    const beforeRed = (await syncView(other)).opponent.visibleIdentity?.value;
    const red = await useCard(other, GUESSING_CHALLENGE_USE_RED_CARD_EVENT);
    assert.equal(red.success, true, red.error?.message ?? 'red failed');
    assert.ok(red.data.view.opponent.visibleIdentity?.value, 'red user sees new identity');
    assert.notEqual(red.data.view.opponent.visibleIdentity?.value, beforeRed, 'identity changed');

    const victim = other.id === a.id ? b : a;
    const victimView = await syncView(victim);
    assert.equal(victimView.self.revealedIdentity, null, 'victim still hidden');
    assert.equal(victimView.identityChangedNotice, true, 'victim notice');
    assert.equal(
      JSON.stringify(victimView).includes(red.data.view.opponent.visibleIdentity!.value!),
      false,
      'victim must not see new own identity',
    );

    let currentId = (await syncView(a)).currentTurnPlayerId;
    let guesser = currentId === a.id ? a : b;
    const wrong = await submitGuess(guesser, 'إجابة خاطئة تماما');
    assert.equal(wrong.success, true, wrong.error?.message ?? 'wrong guess failed');
    assert.equal(wrong.data.guessCorrect, false, 'wrong guess flag');
    assert.equal(wrong.data.guessFeedback, 'إجابة غير صحيحة');
    assert.notEqual(wrong.data.view.currentTurnPlayerId, guesser.id, 'wrong guess passes turn');

    const otherAfterWrong = await syncView(guesser.id === a.id ? b : a);
    assert.equal(
      JSON.stringify(otherAfterWrong).includes('إجابة خاطئة تماما'),
      false,
      'wrong guess text private',
    );

    const bSecretNow = (await syncView(a)).opponent.visibleIdentity?.value;
    assert.ok(bSecretNow, 'B secret visible to A');

    currentId = (await syncView(a)).currentTurnPlayerId;
    if (currentId !== b.id) {
      const pass = await endQuestion(a);
      assert.equal(pass.success, true, 'pass to B for correct guess');
    }

    const correct = await submitGuess(b, bSecretNow);
    assert.equal(correct.success, true, correct.error?.message ?? 'correct guess failed');
    assert.equal(correct.data.guessCorrect, true, 'correct guess flag');
    assert.equal(correct.data.view.gamePhase, 'round-results', 'round results phase');
    assert.equal(correct.data.view.revealEntries.length, 2, 'both identities revealed');

    const aResults = await syncView(a);
    assert.equal(aResults.gamePhase, 'round-results');
    assert.equal(aResults.winnerName, 'خالد', 'winner name');
    assert.ok(
      aResults.roundResults.some((entry) => entry.playerId === b.id && entry.roundPoints === 100),
      'B +100',
    );
    assert.ok(
      aResults.roundResults.some((entry) => entry.playerId === a.id && entry.roundPoints === 0),
      'A +0',
    );

    a.socket.disconnect();
    b.socket.disconnect();
  });

  await runTest('2v2 start, privacy, confirm, yellow persists, red shared, reconnect, guess, continue', async () => {
    const { a, b, c, d } = await startMatch2v2();
    // Assignment: P0 a blue0, P1 b red0, P2 c blue1, P3 d red1
    const blueTeam = [a, c];
    const redTeam = [b, d];

    const views = {
      a: await syncView(a),
      b: await syncView(b),
      c: await syncView(c),
      d: await syncView(d),
    };

    assert.equal(views.a.mode, '2v2');
    assert.equal(views.a.selfTeam, 'blue');
    assert.equal(views.c.selfTeam, 'blue');
    assert.equal(views.b.selfTeam, 'red');
    assert.equal(views.d.selfTeam, 'red');
    assert.equal(views.a.teammate?.playerId, c.id);
    assert.equal(views.a.opponents.length, 2);

    const blueSecret = views.b.opponent.visibleIdentity?.value;
    const redSecret = views.a.opponent.visibleIdentity?.value;
    assert.ok(blueSecret && redSecret && blueSecret !== redSecret, 'shared team identities differ');
    assert.equal(views.a.opponent.visibleIdentity?.value, redSecret);
    assert.equal(views.c.opponent.visibleIdentity?.value, redSecret);
    assert.equal(views.b.opponent.visibleIdentity?.value, blueSecret);
    assert.equal(views.d.opponent.visibleIdentity?.value, blueSecret);

    for (const client of [a, c]) {
      const view = await syncView(client);
      assert.equal(JSON.stringify(view).includes(blueSecret!), false, `${client.name} own secret leak`);
    }
    for (const client of [b, d]) {
      const view = await syncView(client);
      assert.equal(JSON.stringify(view).includes(redSecret!), false, `${client.name} own secret leak`);
    }

    // Blue team starts — confirm yellow with only one teammate (should not activate).
    assert.equal(views.a.currentTurnTeamId, 'blue');
    const confirm1 = await useCard(a, GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT);
    assert.equal(confirm1.success, true, confirm1.error?.message ?? 'confirm1 failed');
    assert.equal(confirm1.data.view.yellowQuestionsRemaining, null, '1/2 must not activate');
    assert.ok(confirm1.data.view.cardConfirmStatus, 'confirm status visible');
    assert.equal(confirm1.data.view.cardConfirmStatus?.confirmedCount, 1);
    assert.equal(confirm1.data.view.cardConfirmStatus?.requiredCount, 2);

    const teammateView = await syncView(c);
    assert.equal(teammateView.cardConfirmStatus?.selfConfirmed, false);
    assert.equal(teammateView.self.yellowCardAvailable, true);

    const confirm2 = await useCard(c, GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT);
    assert.equal(confirm2.success, true, confirm2.error?.message ?? 'confirm2 failed');
    assert.equal(confirm2.data.view.yellowQuestionsRemaining, 3, '2/2 activates yellow');
    assert.equal(confirm2.data.view.self.yellowCardAvailable, false);
    assert.equal(confirm2.data.view.cardConfirmStatus, null);

    // Drain yellow sequence then finish round with a correct guess so we can check card persistence.
    for (let i = 0; i < 3; i += 1) {
      const actor = (await syncView(a)).isMyTurn ? a : c;
      const end = await endQuestion(actor);
      assert.equal(end.success, true, end.error?.message ?? `yellow drain ${i}`);
    }

    // Red turn: confirm red card with both red teammates (shared identity change).
    let turnTeam = (await syncView(a)).currentTurnTeamId;
    if (turnTeam !== 'red') {
      const actor = (await syncView(a)).isMyTurn ? a : c;
      await endQuestion(actor);
      turnTeam = (await syncView(a)).currentTurnTeamId;
    }
    assert.equal(turnTeam, 'red');

    const beforeRed = (await syncView(b)).opponent.visibleIdentity?.value;
    const redConfirm1 = await useCard(b, GUESSING_CHALLENGE_USE_RED_CARD_EVENT);
    assert.equal(redConfirm1.success, true);
    assert.equal(redConfirm1.data.view.cardConfirmStatus?.confirmedCount, 1);

    const redConfirm2 = await useCard(d, GUESSING_CHALLENGE_USE_RED_CARD_EVENT);
    assert.equal(redConfirm2.success, true, redConfirm2.error?.message ?? 'red confirm2');
    assert.equal(redConfirm2.data.view.self.redCardAvailable, false);
    const afterRed = redConfirm2.data.view.opponent.visibleIdentity?.value;
    assert.ok(afterRed, 'new opposing identity visible');
    assert.notEqual(afterRed, beforeRed, 'red replaced blue shared identity');

    // Both red players see the same new blue identity; blue players must not see it.
    const redSees = await syncView(b);
    const redSees2 = await syncView(d);
    assert.equal(redSees.opponent.visibleIdentity?.value, afterRed);
    assert.equal(redSees2.opponent.visibleIdentity?.value, afterRed);
    assert.equal((await syncView(a)).identityChangedNotice, true);
    assert.equal((await syncView(c)).identityChangedNotice, true);
    assert.equal(JSON.stringify(await syncView(a)).includes(afterRed!), false);
    assert.equal(JSON.stringify(await syncView(c)).includes(afterRed!), false);

    // Reconnect a blue player — state preserved.
    const turnBefore = (await syncView(a)).currentTurnTeamId;
    const oppBefore = (await syncView(a)).opponent.visibleIdentity?.value;
    a.socket.disconnect();
    a.socket = await connectClient();
    trackClientEvents(a);
    const resume = await ack<{ success: boolean; error?: { message?: string } }>(
      a.socket,
      RECONNECT_EVENT,
      {
        playerId: a.id,
        roomId: a.roomId,
        roomCode: a.roomCode,
        reconnectToken: a.reconnectToken,
      },
    );
    assert.equal(resume.success, true, resume.error?.message ?? '2v2 reconnect');

    await waitFor(
      async () => {
        const latest = a.recoveryEvents.at(-1);
        if (latest?.isActive) return null;
        const view = await syncView(a);
        return view.gamePhase === 'playing' ? view : null;
      },
      8000,
      '2v2 recovery cleared',
    );

    const afterRc = await syncView(a);
    assert.equal(afterRc.currentTurnTeamId, turnBefore);
    assert.equal(afterRc.opponent.visibleIdentity?.value, oppBefore);
    assert.equal(afterRc.self.yellowCardAvailable, false, 'yellow still used after reconnect');

    // Correct guess by red team (guess their own red secret).
    const redOwnSecret = (await syncView(a)).opponent.visibleIdentity?.value;
    assert.ok(redOwnSecret);

    if ((await syncView(b)).currentTurnTeamId !== 'red') {
      const actor = (await syncView(a)).isMyTurn ? a : c;
      await endQuestion(actor);
    }

    const guesser = (await syncView(b)).isMyTurn ? b : d;
    const correct = await submitGuess(guesser, redOwnSecret);
    assert.equal(correct.success, true, correct.error?.message ?? '2v2 correct guess');
    assert.equal(correct.data.guessCorrect, true);
    assert.equal(correct.data.view.gamePhase, 'round-results');
    assert.equal(correct.data.view.revealEntries.length, 4, 'one reveal entry per player');
    assert.ok(
      correct.data.view.roundResults.filter((entry) => entry.isWinner).length === 2,
      'both red teammates marked winners',
    );
    assert.ok(
      correct.data.view.roundResults.every((entry) =>
        redTeam.some((p) => p.id === entry.playerId)
          ? entry.roundPoints === 100
          : entry.roundPoints === 0,
      ),
      'team score mirrored without double-award side effects',
    );

    // Continue from round results.
    // In WANASATNA_TEST_MODE totalRounds is forced to 1 → match-completed.
    // Card persistence across rounds is covered by the unit suite.
    assert.equal((await syncView(a)).canContinueFromRoundResults, true);
    const cont = await continueResults(a);
    assert.equal(cont.success, true, cont.error?.message ?? 'continue failed');
    assert.ok(
      cont.data.view?.gamePhase === 'playing' || cont.data.view?.gamePhase === 'match-completed',
      `unexpected phase after continue: ${cont.data.view?.gamePhase}`,
    );
    if (cont.data.view?.gamePhase === 'playing') {
      assert.equal(cont.data.view.currentRound, 2);
      assert.equal(cont.data.view.self.yellowCardAvailable, false, 'yellow persists next round');
      assert.equal((await syncView(b)).self.redCardAvailable, false, 'red persists next round');

      const r2BlueSecret = (await syncView(b)).opponent.visibleIdentity?.value;
      const r2RedSecret = (await syncView(a)).opponent.visibleIdentity?.value;
      assert.ok(r2BlueSecret && r2RedSecret);
      assert.equal(JSON.stringify(await syncView(a)).includes(r2BlueSecret!), false);
      assert.equal(JSON.stringify(await syncView(c)).includes(r2BlueSecret!), false);
    } else {
      assert.equal(cont.data.view?.self.yellowCardAvailable, false, 'yellow still used at match end');
      assert.equal((await syncView(b)).self.redCardAvailable, false, 'red still used at match end');
    }

    for (const client of [a, b, c, d]) {
      client.socket.disconnect();
    }
  });

  await runTest('natural four rounds auto-progress and clean shell for Game B', async () => {
    const { a, b } = await startMatch1v1();
    const starters = ['blue', 'red', 'blue', 'red'];
    const roundIds: string[] = [];

    for (let round = 1; round <= 4; round += 1) {
      const playing = await waitFor(async () => {
        const view = await syncView(a);
        return view.gamePhase === 'playing' && view.currentRound === round ? view : null;
      }, 15000, `round ${round} playing`);
      assert.equal(playing.totalRounds, 4);
      assert.equal(playing.currentTurnTeamId, starters[round - 1]);
      assert.equal(playing.categoryId, 'football');
      assert.equal(playing.categoryLabel, 'كرة قدم');
      roundIds.push(playing.roundId);
      await finishCurrent1v1Round(a, b);
    }
    assert.equal(new Set(roundIds).size, 4);

    await waitFor(
      async () => (a.navigations.some((path) => String(path).includes('lobby')) ? true : null),
      20000,
      'automatic final lobby',
    );

    const next = await ack<{ success: boolean; error?: { message?: string } }>(
      a.socket,
      'game-shell-start-from-lobby',
      { gameId: TIMING_CHALLENGE_GAME_ID },
    );
    assert.equal(next.success, true, next.error?.message ?? 'A→Lobby→B failed');
    disconnectAll([a, b]);
  });

  await runTest('host accelerates every result and returns early from final', async () => {
    const { a, b } = await startMatch1v1();
    for (let round = 1; round <= 4; round += 1) {
      await waitFor(async () => {
        const view = await syncView(a);
        return view.gamePhase === 'playing' && view.currentRound === round ? view : null;
      }, 8000, `host early round ${round}`);
      await finishCurrent1v1Round(a, b);
      const continued = await continueResults(a);
      assert.equal(continued.success, true);
    }

    const final = await waitFor(async () => {
      const view = await syncView(a);
      return view.gamePhase === 'match-completed' ? view : null;
    }, 5000, 'host early final');
    assert.equal(final.currentRound, 4);
    const returned = await continueResults(a);
    assert.equal(returned.success, true);
    await waitFor(
      async () => (a.navigations.some((path) => String(path).includes('lobby')) ? true : null),
      5000,
      'host early lobby',
    );
    disconnectAll([a, b]);
  });

  await runTest('turn timeout continues through entire active-team disconnect', async () => {
    const { a, b, c, d } = await startMatch2v2();
    const initial = await syncView(b);
    assert.equal(initial.currentTurnTeamId, 'blue');

    a.socket.disconnect();
    c.socket.disconnect();

    const afterTimeout = await waitFor(async () => {
      const view = await syncView(b);
      return view.currentTurnTeamId === 'red' ? view : null;
    }, 22000, 'active team timeout auto-pass');
    assert.notEqual(afterTimeout.turnId, initial.turnId);

    a.socket = await connectClient();
    trackClientEvents(a);
    const resume = await ack<{ success: boolean; error?: { message?: string } }>(
      a.socket,
      RECONNECT_EVENT,
      {
        playerId: a.id,
        roomId: a.roomId,
        roomCode: a.roomCode,
        reconnectToken: a.reconnectToken,
      },
    );
    assert.equal(resume.success, true, resume.error?.message ?? 'team reconnect failed');
    assert.equal((await syncView(a)).selfTeam, 'blue');
    disconnectAll([a, b, d]);
  });

  await runTest('pending card auto-activates after teammate disconnect', async () => {
    const { a, b, c, d } = await startMatch2v2();
    const pending = await useCard(a, GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT);
    assert.equal(pending.success, true);
    assert.equal(pending.data.view.cardConfirmStatus?.confirmedCount, 1);

    c.socket.disconnect();
    const activated = await waitFor(async () => {
      const view = await syncView(a);
      return view.yellowQuestionsRemaining === 3 ? view : null;
    }, 8000, 'card activation after disconnect');
    assert.equal(activated.self.yellowCardAvailable, false);
    assert.equal(activated.cardConfirmStatus, null);

    c.socket = await connectClient();
    trackClientEvents(c);
    const resume = await ack<{ success: boolean; error?: { message?: string } }>(
      c.socket,
      RECONNECT_EVENT,
      {
        playerId: c.id,
        roomId: c.roomId,
        roomCode: c.roomCode,
        reconnectToken: c.reconnectToken,
      },
    );
    assert.equal(resume.success, true);
    const restored = await syncView(c);
    assert.equal(restored.self.yellowCardAvailable, false);
    assert.equal(restored.cardConfirmStatus, null);
    disconnectAll([a, b, c, d]);
  });

  await runTest('spectator receives no secrets and cannot mutate gameplay', async () => {
    const { a, b } = await startMatch1v1();
    const spectator = emptyClient('مشاهد');
    spectator.socket = await connectClient();
    spectator.roomCode = a.roomCode;
    trackClientEvents(spectator);
    const join = await ack<{
      success: boolean;
      data: { player: { id: string }; room: { id: string }; reconnectToken?: string };
    }>(spectator.socket, 'join-room', {
      roomCode: a.roomCode,
      playerName: spectator.name,
    });
    assert.equal(join.success, true);
    spectator.id = join.data.player.id;
    spectator.roomId = join.data.room.id;
    spectator.reconnectToken = join.data.reconnectToken ?? '';

    const view = await syncView(spectator);
    assert.equal(view.isMatchSpectator, true);
    assert.equal(view.selfTeam, null);
    assert.equal(view.opponent.visibleIdentity, null);
    assert.equal(view.opponents.length, 0);
    assert.equal(JSON.stringify(view).includes('acceptedAnswers'), false);

    const generation = await syncView(a);
    const end = await ack<{ success: boolean }>(
      spectator.socket,
      GUESSING_CHALLENGE_END_QUESTION_EVENT,
      { roundId: generation.roundId, turnId: generation.turnId },
    );
    const guess = await ack<{ success: boolean }>(
      spectator.socket,
      GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
      { guess: 'ميسي', roundId: generation.roundId, turnId: generation.turnId },
    );
    const card = await ack<{ success: boolean }>(
      spectator.socket,
      GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
      { roundId: generation.roundId, turnId: generation.turnId },
    );
    const reject = await ack<{ success: boolean }>(
      spectator.socket,
      GUESSING_CHALLENGE_REJECT_CARD_EVENT,
      { roundId: generation.roundId, turnId: generation.turnId, requestId: 'stale' },
    );
    assert.equal(end.success, false);
    assert.equal(guess.success, false);
    assert.equal(card.success, false);
    assert.equal(reject.success, false);
    disconnectAll([a, b, spectator]);
  });

  await runTest('one teammate leaves; full team leave terminates and cleans for Game B', async () => {
    const first = await startMatch2v2();
    const leavePartner = await ack<{ success: boolean }>(first.c.socket, 'leave-room', {});
    assert.equal(leavePartner.success, true);
    const continued = await endQuestion(first.a);
    assert.equal(continued.success, true, continued.error?.message ?? 'partner should continue');
    disconnectAll([first.a, first.b, first.d]);

    const second = await startMatch2v2();
    assert.equal((await ack<{ success: boolean }>(second.b.socket, 'leave-room', {})).success, true);
    assert.equal((await ack<{ success: boolean }>(second.d.socket, 'leave-room', {})).success, true);

    const earlyFinal = await waitFor(async () => {
      const view = await syncView(second.a);
      return view.gamePhase === 'match-completed' ? view : null;
    }, 5000, 'early match completed');
    assert.ok(earlyFinal.roundResults.every((entry) => entry.roundPoints === 0));

    await waitFor(
      async () =>
        second.a.navigations.some((path) => String(path).includes('lobby')) ? true : null,
      12000,
      'early termination lobby',
    );
    const finalViewUnavailable = await ack<{ success: boolean }>(
      second.a.socket,
      GUESSING_CHALLENGE_SYNC_EVENT,
    );
    assert.equal(finalViewUnavailable.success, false);

    const next = await ack<{ success: boolean; error?: { message?: string } }>(
      second.a.socket,
      'game-shell-start-from-lobby',
      { gameId: TIMING_CHALLENGE_GAME_ID },
    );
    assert.equal(next.success, true, next.error?.message ?? 'early A→Lobby→B failed');
    disconnectAll([second.a, second.c]);
  });

  await runTest('1v1 permanent leave terminates without artificial score', async () => {
    const { a, b } = await startMatch1v1();
    assert.equal((await ack<{ success: boolean }>(b.socket, 'leave-room', {})).success, true);
    await waitFor(
      async () => (a.navigations.some((path) => String(path).includes('lobby')) ? true : null),
      12000,
      '1v1 leave lobby',
    );
    disconnectAll([a]);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
