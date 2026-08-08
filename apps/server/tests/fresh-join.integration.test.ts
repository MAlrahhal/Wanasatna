/**
 * Fresh join during active match integration tests.
 * Run: pnpm --filter @wanasatna/server test:fresh-join
 */
import assert from 'node:assert/strict';
import {
  BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT,
  BARA_AL_SALAFA_SYNC_EVENT,
  GAME_SHELL_SYNC_EVENT,
} from '@wanasatna/shared';
import {
  disconnectClient,
  hostEndGame,
  reconnectClient,
  startThreePlayerMatch,
  waitForRecoveryActive,
  waitForRecoveryInactive,
} from './helpers/lifecycle-driver.js';
import {
  ack,
  connectClient,
  sleep,
  trackClientEvents,
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

async function joinFreshPlayer(roomCode: string, playerName: string): Promise<TestClient> {
  const socket = await connectClient();
  const client: TestClient = {
    name: playerName,
    socket,
    id: '',
    roomId: '',
    roomCode,
    reconnectToken: '',
    shellEvents: [],
    roster: [],
    navigations: [],
    recoveryEvents: [],
  };
  trackClientEvents(client);

  const joinRes = await ack<{ success: boolean; data: { player: { id: string }; room: { id: string }; reconnectToken?: string } }>(
    client.socket,
    'join-room',
    { roomCode, playerName },
  );
  assert.ok(joinRes.success, 'fresh join succeeds');
  client.id = joinRes.data.player.id;
  client.roomId = joinRes.data.room.id;
  client.reconnectToken = joinRes.data.reconnectToken ?? '';
  return client;
}

async function syncShell(client: TestClient) {
  return ack<{ success: boolean; data: { state: { phase: string; matchParticipantIds: string[] | null } } }>(
    client.socket,
    GAME_SHELL_SYNC_EVENT,
  );
}

async function main(): Promise<void> {
  await import('./helpers/socket-utils.js').then(({ waitForServer }) => waitForServer());

  await runTest('A fresh player joins during active match and is not a match participant', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const waiter = await joinFreshPlayer(roomCode, 'أحمد');

    const shellRes = await syncShell(waiter);
    assert.ok(shellRes.success);
    assert.ok(shellRes.data.state.matchParticipantIds);
    assert.equal(shellRes.data.state.matchParticipantIds.includes(waiter.id), false);

    host.socket.disconnect();
    clients.forEach((c) => c.socket.disconnect());
    waiter.socket.disconnect();
  });

  await runTest('B fresh waiting player receives no private game state', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const waiter = await joinFreshPlayer(roomCode, 'أحمد');

    const syncRes = await ack<{ success: boolean; error?: { code: string } }>(
      waiter.socket,
      BARA_AL_SALAFA_SYNC_EVENT,
    );
    assert.equal(syncRes.success, false);
    assert.equal(syncRes.error?.code, 'NOT_PARTICIPANT');

    host.socket.disconnect();
    clients.forEach((c) => c.socket.disconnect());
    waiter.socket.disconnect();
  });

  await runTest('C fresh waiting player does not cancel recovery countdown', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();

    await disconnectClient(clients[1]!);
    await disconnectClient(clients[2]!);
    await waitForRecoveryActive(host);

    const activeBefore = host.recoveryEvents.filter((event) => event.isActive).at(-1);
    assert.ok(activeBefore);
    assert.equal(activeBefore!.connectedCount, 1);

    await joinFreshPlayer(roomCode, 'أحمد');

    await sleep(400);
    const activeAfter = host.recoveryEvents.filter((event) => event.isActive).at(-1);
    assert.ok(activeAfter?.isActive);
    assert.equal(activeAfter!.connectedCount, 1);

    host.socket.disconnect();
    clients.forEach((c) => c.socket.disconnect());
  });

  await runTest('D original participant reconnect cancels recovery', async () => {
    const { host, clients } = await startThreePlayerMatch();

    await disconnectClient(clients[1]!);
    await disconnectClient(clients[2]!);
    await waitForRecoveryActive(host);

    await reconnectClient(clients[1]!);
    await reconnectClient(clients[2]!);
    await waitForRecoveryInactive(host);

    host.socket.disconnect();
    clients.forEach((c) => c.socket.disconnect());
  });

  await runTest('E explicit leave then fresh rejoin becomes waiting player', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const leaver = clients[2]!;
    const leaveName = leaver.name;

    const leaveRes = await ack<{ success: boolean }>(leaver.socket, 'leave-room');
    assert.ok(leaveRes.success);
    leaver.socket.disconnect();
    await sleep(200);

    const returning = await joinFreshPlayer(roomCode, leaveName);
    assert.notEqual(returning.id, leaver.id);

    const shellRes = await syncShell(returning);
    assert.ok(shellRes.success);
    assert.equal(shellRes.data.state.matchParticipantIds?.includes(returning.id), false);

    host.socket.disconnect();
    clients[0]!.socket.disconnect();
    clients[1]!.socket.disconnect();
    returning.socket.disconnect();
  });

  await runTest('F shell sync distinguishes match participants from waiting players', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const waiter = await joinFreshPlayer(roomCode, 'أحمد');

    const participantShell = await syncShell(host);
    const waitingShell = await syncShell(waiter);

    assert.ok(participantShell.success);
    assert.ok(waitingShell.success);
    assert.equal(participantShell.data.state.matchParticipantIds?.includes(host.id), true);
    assert.equal(waitingShell.data.state.matchParticipantIds?.includes(waiter.id), false);

    host.socket.disconnect();
    clients.forEach((c) => c.socket.disconnect());
    waiter.socket.disconnect();
  });

  await runTest('G match end keeps waiting player in room for next game', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const waiter = await joinFreshPlayer(roomCode, 'أحمد');

    await hostEndGame(host);
    await sleep(300);

    const shellRes = await syncShell(waiter);
    assert.ok(shellRes.success);
    assert.equal(shellRes.data.state, null);
    assert.ok(waiter.roster.includes('أحمد'));

    host.socket.disconnect();
    clients.forEach((c) => c.socket.disconnect());
    waiter.socket.disconnect();
  });

  await runTest('H waiting player game action is rejected', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const waiter = await joinFreshPlayer(roomCode, 'أحمد');

    const actionRes = await ack<{ success: boolean; error?: { code: string } }>(
      waiter.socket,
      BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT,
    );
    assert.equal(actionRes.success, false);
    assert.equal(actionRes.error?.code, 'NOT_PARTICIPANT');

    host.socket.disconnect();
    clients.forEach((c) => c.socket.disconnect());
    waiter.socket.disconnect();
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('fresh-join suite crashed:', error);
  process.exit(1);
});
