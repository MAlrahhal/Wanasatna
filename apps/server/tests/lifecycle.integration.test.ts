/**
 * Lifecycle integration tests: abort match, leave, player recovery.
 * Requires server on localhost:4001 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:lifecycle
 */
import assert from 'node:assert/strict';
import { GAME_SHELL_END_EVENT } from '@wanasatna/shared';
import {
  assertHostEndGameRejected,
  disconnectClient,
  hostEndGame,
  reconnectClient,
  startMatchWithPlayers,
  startThreePlayerMatch,
  waitForRecoveryActive,
  waitForRecoveryInactive,
} from './helpers/lifecycle-driver.js';
import { ack, sleep, syncView, waitFor, waitForServer } from './helpers/socket-utils.js';

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

async function main(): Promise<void> {
  console.log('[lifecycle] waiting for test server...');
  await waitForServer();

  await runTest('A host manually ends game', async () => {
    const { host, clients } = await startThreePlayerMatch();
    await hostEndGame(host);

    await waitFor(
      async () => (clients.every((c) => c.navigations.includes('/lobby')) ? true : null),
      5000,
      'all navigate lobby',
      200,
    );

    const syncRes = await ack<{ success: boolean; data: { state: null | unknown } }>(
      host.socket,
      'game-shell-sync',
    );
    assert.ok(syncRes.success);
    assert.equal(syncRes.data.state, null);

    for (const c of clients) {
      c.socket.disconnect();
    }
  });

  await runTest('B non-host end game rejected NOT_HOST', async () => {
    const { host, clients } = await startThreePlayerMatch();
    await assertHostEndGameRejected(clients[1]!);

    for (const c of clients) {
      c.socket.disconnect();
    }
    host.socket.disconnect();
  });

  await runTest('C non-host leaves mid-game', async () => {
    const { host, clients } = await startThreePlayerMatch();
    const leaver = clients[2]!;

    const leaveRes = await ack<{ success: boolean }>(leaver.socket, 'leave-room');
    assert.ok(leaveRes.success);

    await waitFor(
      async () => (host.roster.length === 2 ? true : null),
      5000,
      'roster after leave',
      200,
    );

    leaver.socket.disconnect();
    host.socket.disconnect();
    clients[1]!.socket.disconnect();
  });

  await runTest('D disconnect above minimum no recovery', async () => {
    const { host, clients } = await startMatchWithPlayers(4);
    const viewBefore = await syncView(host.socket);

    await disconnectClient(clients[3]!);
    await sleep(800);

    assert.equal(
      host.recoveryEvents.some((event) => event.isActive),
      false,
      'no recovery with 3/3 connected participants',
    );

    const viewAfter = await syncView(host.socket);
    assert.equal(viewAfter.currentRound, viewBefore.currentRound);
    assert.equal(viewAfter.gamePhase, viewBefore.gamePhase);

    for (const c of clients) {
      c.socket.disconnect();
    }
  });

  await runTest('E disconnect below minimum starts recovery', async () => {
    const { host, clients } = await startThreePlayerMatch();

    await disconnectClient(clients[1]!);
    await disconnectClient(clients[2]!);
    await waitForRecoveryActive(host);

    const active = host.recoveryEvents.find((event) => event.isActive);
    assert.ok(active);
    assert.equal(active!.minimumCount, 3);
    assert.equal(active!.connectedCount, 1);
    assert.ok(active!.remainingSeconds <= 2 && active!.remainingSeconds >= 1);

    host.socket.disconnect();
  });

  await runTest('F reconnect cancels recovery and preserves match', async () => {
    const { host, clients } = await startThreePlayerMatch();
    const viewBefore = await syncView(host.socket);
    const roleBefore = (await syncView(clients[2]!.socket)).role;

    await disconnectClient(clients[2]!);
    await waitForRecoveryActive(host);

    await reconnectClient(clients[2]!);
    await waitForRecoveryInactive(host);

    const viewAfter = await syncView(host.socket);
    assert.equal(viewAfter.currentRound, viewBefore.currentRound);
    assert.equal(viewAfter.gamePhase, viewBefore.gamePhase);
    assert.equal((await syncView(clients[2]!.socket)).role, roleBefore);

    for (const c of clients) {
      c.socket.disconnect();
    }
    host.socket.disconnect();
  });

  await runTest('G recovery timeout aborts to lobby', async () => {
    const { host, clients } = await startThreePlayerMatch();

    await disconnectClient(clients[1]!);
    await disconnectClient(clients[2]!);
    await waitForRecoveryActive(host);

    await waitFor(
      async () => (host.navigations.includes('/lobby') ? true : null),
      5000,
      'lobby after recovery timeout',
      200,
    );

    host.socket.disconnect();
  });

  await runTest('H timed phase timer freezes during recovery', async () => {
    const { host, clients } = await startThreePlayerMatch();
    const remainingBefore = (await syncView(host.socket)).phaseRemainingSeconds;

    await disconnectClient(clients[1]!);
    await disconnectClient(clients[2]!);
    await waitForRecoveryActive(host);

    const remainingDuring = (await syncView(host.socket)).phaseRemainingSeconds;
    assert.equal(remainingDuring, remainingBefore, 'phase timer frozen during recovery');
    await sleep(400);
    const remainingStill = (await syncView(host.socket)).phaseRemainingSeconds;
    assert.equal(remainingStill, remainingBefore, 'phase timer stays frozen');

    await reconnectClient(clients[1]!);
    await reconnectClient(clients[2]!);
    await waitForRecoveryInactive(host);
    await sleep(1200);

    const remainingAfter = (await syncView(host.socket)).phaseRemainingSeconds;
    assert.ok(remainingAfter <= remainingBefore, 'timer resumes after recovery');

    for (const c of clients) {
      c.socket.disconnect();
    }
    host.socket.disconnect();
  });

  await runTest('I multiple disconnect/reconnect keeps single recovery timer', async () => {
    const { host, clients } = await startThreePlayerMatch();

    await disconnectClient(clients[1]!);
    await disconnectClient(clients[2]!);
    await waitForRecoveryActive(host);
    const firstDeadline = host.recoveryEvents.find((event) => event.isActive)?.remainingSeconds;

    await reconnectClient(clients[1]!);
    await waitForRecoveryInactive(host);

    await disconnectClient(clients[1]!);
    await waitForRecoveryActive(host);
    const secondDeadline = host.recoveryEvents.find((event) => event.isActive)?.remainingSeconds;

    assert.ok(typeof firstDeadline === 'number');
    assert.ok(typeof secondDeadline === 'number');
    assert.ok(secondDeadline <= 2);

    await reconnectClient(clients[1]!);
    await waitForRecoveryInactive(host);

    for (const c of clients) {
      c.socket.disconnect();
    }
    host.socket.disconnect();
  });

  await runTest('J host disconnect starts recovery without immediate abort', async () => {
    const { host, clients } = await startThreePlayerMatch();
    const viewBefore = await syncView(host.socket);

    await disconnectClient(host);
    await sleep(500);

    assert.equal(clients[1]!.navigations.includes('/lobby'), false, 'no immediate lobby abort');
    await waitForRecoveryActive(clients[1]!);

    const viewAfter = await syncView(clients[1]!.socket);
    assert.equal(viewAfter.currentRound, viewBefore.currentRound);

    host.socket.disconnect();
    clients[1]!.socket.disconnect();
    clients[2]!.socket.disconnect();
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('lifecycle suite crashed:', error);
  process.exit(1);
});
