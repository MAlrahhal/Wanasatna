/**
 * Guessing Challenge Socket.IO multiplayer (A + B).
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:guessing-challenge:integration
 */
import assert from 'node:assert/strict';
import {
  GUESSING_CHALLENGE_END_QUESTION_EVENT,
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
  GUESSING_CHALLENGE_SYNC_EVENT,
  GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
  GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT,
  RECONNECT_EVENT,
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
  isMyTurn: boolean;
  currentTurnPlayerId: string | null;
  self: {
    playerId: string;
    revealedIdentity: { value: string | null } | null;
    yellowCardAvailable: boolean;
    redCardAvailable: boolean;
  };
  opponent: {
    playerId: string;
    visibleIdentity: { value: string | null } | null;
  };
  yellowQuestionsRemaining: number | null;
  canEndQuestion: boolean;
  canGuess: boolean;
  canUseYellow: boolean;
  canUseRed: boolean;
  identityChangedNotice: boolean;
  winnerName: string | null;
  winningGuess: string | null;
  revealEntries: Array<{ playerId: string; identity: { value: string | null }; isWinner: boolean }>;
  roundResults: Array<{ playerId: string; roundPoints: number }>;
};

async function syncView(client: TestClient): Promise<SyncView> {
  const syncRes = await ack<{ success: boolean; data: { view: SyncView } }>(
    client.socket,
    GUESSING_CHALLENGE_SYNC_EVENT,
  );
  assert.equal(syncRes.success, true, 'sync failed');
  return syncRes.data.view;
}

async function startMatch(): Promise<{ a: TestClient; b: TestClient }> {
  const hostSocket = await connectClient();
  const a: TestClient = {
    name: 'محمد',
    socket: hostSocket,
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
  const b: TestClient = {
    name: 'خالد',
    socket: bSocket,
    id: '',
    roomId: '',
    roomCode: a.roomCode,
    reconnectToken: '',
    shellEvents: [],
    roster: [],
    rosterPlayers: [],
    navigations: [],
    recoveryEvents: [],
  };
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
    { gameId: GUESSING_CHALLENGE_GAME_ID, categoryId: 'football' },
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

async function main(): Promise<void> {
  console.log('[guessing-challenge] waiting for test server...');
  await waitForServer();

  await runTest('A+B privacy, turns, yellow, red, reconnect, wrong+correct guess', async () => {
    const { a, b } = await startMatch();

    const viewA = await syncView(a);
    const viewB = await syncView(b);

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

    const end1 = await ack<{ success: boolean; error?: { message?: string } }>(
      starter.socket,
      GUESSING_CHALLENGE_END_QUESTION_EVENT,
    );
    assert.equal(end1.success, true, end1.error?.message ?? 'end-question 1 failed');

    const afterEnd1 = await syncView(a);
    assert.equal(afterEnd1.currentTurnPlayerId, other.id, 'turn should pass to other');

    // Reconnect A early (1v1 recovery window is short in test mode).
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

    const afterReconnect = await syncView(a);
    assert.equal(afterReconnect.gamePhase, 'playing', 'phase after reconnect');
    assert.equal(afterReconnect.self.revealedIdentity, null, 'own identity still hidden');
    assert.equal(afterReconnect.currentTurnPlayerId, turnBeforeReconnect, 'turn preserved');
    assert.equal(
      afterReconnect.opponent.visibleIdentity?.value,
      oppBeforeReconnect,
      'opponent identity preserved',
    );

    // Ensure other has the turn for yellow/red actions.
    let turnView = await syncView(other);
    if (turnView.currentTurnPlayerId !== other.id) {
      const pass = await ack<{ success: boolean; error?: { message?: string } }>(
        starter.id === other.id ? a.socket : starter.socket,
        GUESSING_CHALLENGE_END_QUESTION_EVENT,
      );
      // If starter is A and reconnect replaced socket, use current starter socket.
      if (!pass.success) {
        const pass2 = await ack<{ success: boolean; error?: { message?: string } }>(
          (await syncView(a)).currentTurnPlayerId === a.id ? a.socket : b.socket,
          GUESSING_CHALLENGE_END_QUESTION_EVENT,
        );
        assert.equal(pass2.success, true, pass2.error?.message ?? 'pass turn failed');
      }
      turnView = await syncView(other);
    }

    // Force a known turn owner: if not other, end once from current.
    turnView = await syncView(a);
    if (turnView.currentTurnPlayerId !== other.id) {
      const current =
        turnView.currentTurnPlayerId === a.id ? a : b;
      const pass = await ack<{ success: boolean; error?: { message?: string } }>(
        current.socket,
        GUESSING_CHALLENGE_END_QUESTION_EVENT,
      );
      assert.equal(pass.success, true, pass.error?.message ?? 'pass to other failed');
    }

    const yellow = await ack<{ success: boolean; data: { view: SyncView }; error?: { message?: string } }>(
      other.socket,
      GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT,
    );
    assert.equal(yellow.success, true, yellow.error?.message ?? 'yellow failed');
    assert.equal(yellow.data.view.yellowQuestionsRemaining, 3, 'yellow starts at 3');

    const y1 = await ack<{ success: boolean; data: { view: SyncView } }>(
      other.socket,
      GUESSING_CHALLENGE_END_QUESTION_EVENT,
    );
    assert.equal(y1.success, true, 'yellow q1');
    assert.equal(y1.data.view.currentTurnPlayerId, other.id);
    assert.equal(y1.data.view.yellowQuestionsRemaining, 2);

    const y2 = await ack<{ success: boolean; data: { view: SyncView } }>(
      other.socket,
      GUESSING_CHALLENGE_END_QUESTION_EVENT,
    );
    assert.equal(y2.success, true, 'yellow q2');
    assert.equal(y2.data.view.yellowQuestionsRemaining, 1);

    const y3 = await ack<{ success: boolean; data: { view: SyncView } }>(
      other.socket,
      GUESSING_CHALLENGE_END_QUESTION_EVENT,
    );
    assert.equal(y3.success, true, 'yellow q3');
    assert.equal(y3.data.view.currentTurnPlayerId, starter.id);
    assert.equal(y3.data.view.yellowQuestionsRemaining, null);

    // Put turn back to other for red card.
    if ((await syncView(a)).currentTurnPlayerId !== other.id) {
      const pass = await ack<{ success: boolean }>(
        starter.socket,
        GUESSING_CHALLENGE_END_QUESTION_EVENT,
      );
      assert.equal(pass.success, true, 'pass for red');
    }

    const beforeRed = (await syncView(other)).opponent.visibleIdentity?.value;
    const red = await ack<{ success: boolean; data: { view: SyncView }; error?: { message?: string } }>(
      other.socket,
      GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
    );
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

    // Wrong guess by current turn player.
    let currentId = (await syncView(a)).currentTurnPlayerId;
    let guesser = currentId === a.id ? a : b;
    const wrong = await ack<{
      success: boolean;
      data: { view: SyncView; guessCorrect?: boolean; guessFeedback?: string };
      error?: { message?: string };
    }>(guesser.socket, GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT, {
      guess: 'إجابة خاطئة تماما',
    });
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

    // Correct guess: B's secret is visible on A's opponent card (may have changed via red).
    const bSecretNow = (await syncView(a)).opponent.visibleIdentity?.value;
    assert.ok(bSecretNow, 'B secret visible to A');

    currentId = (await syncView(a)).currentTurnPlayerId;
    if (currentId !== b.id) {
      const pass = await ack<{ success: boolean }>(a.socket, GUESSING_CHALLENGE_END_QUESTION_EVENT);
      assert.equal(pass.success, true, 'pass to B for correct guess');
    }

    const correct = await ack<{
      success: boolean;
      data: { view: SyncView; guessCorrect?: boolean };
      error?: { message?: string };
    }>(b.socket, GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT, { guess: bSecretNow });
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

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
