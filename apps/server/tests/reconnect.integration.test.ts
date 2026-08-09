/**
 * Reconnect token integration tests.
 * Run: pnpm --filter @wanasatna/server test:reconnect
 */
import assert from 'node:assert/strict';
import { BARA_AL_SALAFA_GAME_ID, BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT, GAME_SHELL_END_EVENT } from '@wanasatna/shared';
import {
  disconnectClient,
  reconnectClient,
  startThreePlayerMatch,
  waitForRecoveryActive,
  waitForRecoveryInactive,
} from './helpers/lifecycle-driver.js';
import { ack, connectClient, sleep, syncView, waitFor, waitForServer, trackClientEvents } from './helpers/socket-utils.js';

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
  await waitForServer();

  await runTest('A refresh reconnect restores same playerId', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const target = clients[1]!;
    const playerId = target.id;
    const token = target.reconnectToken;

    target.socket.disconnect();
    await sleep(200);
    target.socket = await connectClient();
    trackClientEvents(target);

    const res = await ack<{ success: boolean; data: { player: { id: string; name: string } } }>(
      target.socket,
      'reconnect',
      { playerId, roomId: target.roomId, roomCode, reconnectToken: token },
    );
    assert.ok(res.success);
    assert.equal(res.data.player.id, playerId);

    for (const c of clients) c.socket.disconnect();
    host.socket.disconnect();
  });

  await runTest('C different typed name still restores original player', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const target = clients[2]!;
    const originalName = target.name;

    target.socket.disconnect();
    await sleep(200);
    target.socket = await connectClient();

    const res = await ack<{ success: boolean; data: { player: { name: string } } }>(
      target.socket,
      'reconnect',
      {
        playerId: target.id,
        roomId: target.roomId,
        roomCode,
        reconnectToken: target.reconnectToken,
      },
    );
    assert.ok(res.success);
    assert.equal(res.data.player.name, originalName);

    host.socket.disconnect();
    clients[0]!.socket.disconnect();
    clients[1]!.socket.disconnect();
  });

  await runTest('D same name without token cannot impersonate disconnected player', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const disconnected = clients[1]!;
    const targetName = disconnected.name;

    await disconnectClient(disconnected);

    const badReconnect = await ack<{ success: boolean; error?: { code: string } }>(
      host.socket,
      'reconnect',
      {
        playerId: disconnected.id,
        roomId: disconnected.roomId,
        roomCode,
        reconnectToken: 'not-the-real-token-value',
      },
    );
    assert.equal(badReconnect.success, false);
    assert.equal(badReconnect.error?.code, 'RECONNECT_INVALID_TOKEN');

    const joinRes = await ack<{ success: boolean; error?: { code: string } }>(host.socket, 'join-room', {
      roomCode,
      playerName: targetName,
    });
    assert.equal(joinRes.success, false);
    assert.equal(joinRes.error?.code, 'PLAYER_ALREADY_EXISTS');

    host.socket.disconnect();
    clients.forEach((c) => c.socket.disconnect());
  });

  await runTest('E invalid token rejected', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const res = await ack<{ success: boolean; error?: { code: string } }>(host.socket, 'reconnect', {
      playerId: host.id,
      roomId: host.roomId,
      roomCode,
      reconnectToken: 'invalid-token-value-1234567890',
    });
    assert.equal(res.success, false);
    assert.equal(res.error?.code, 'RECONNECT_INVALID_TOKEN');

    for (const c of clients) c.socket.disconnect();
    host.socket.disconnect();
  });

  await runTest('F explicit leave invalidates token', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const leaver = clients[2]!;
    const token = leaver.reconnectToken;

    const leaveRes = await ack<{ success: boolean }>(leaver.socket, 'leave-room');
    assert.ok(leaveRes.success);

    leaver.socket.disconnect();
    await sleep(200);
    leaver.socket = await connectClient();

    const recon = await ack<{ success: boolean; error?: { code: string } }>(leaver.socket, 'reconnect', {
      playerId: leaver.id,
      roomId: leaver.roomId,
      roomCode,
      reconnectToken: token,
    });
    assert.equal(recon.success, false);
    assert.equal(recon.error?.code, 'RECONNECT_INVALID_TOKEN');

    host.socket.disconnect();
    clients[0]!.socket.disconnect();
    clients[1]!.socket.disconnect();
  });

  await runTest('G active match reconnect preserves role', async () => {
    const { host, clients } = await startThreePlayerMatch();
    const target = clients[1]!;
    const roleBefore = (await syncView(target.socket)).role;

    await disconnectClient(target);
    await reconnectClient(target);

    const roleAfter = (await syncView(target.socket)).role;
    assert.equal(roleAfter, roleBefore);

    for (const c of clients) c.socket.disconnect();
    host.socket.disconnect();
  });

  await runTest('H recovery cancels and overlay clears on reconnect', async () => {
    const { host, clients } = await startThreePlayerMatch();

    await disconnectClient(clients[1]!);
    await disconnectClient(clients[2]!);
    await waitForRecoveryActive(host);

    const activeBefore = host.recoveryEvents.filter((event) => event.isActive);
    assert.ok(activeBefore.length >= 1);
    const sequenceBefore = activeBefore.at(-1)!.sequence;

    await reconnectClient(clients[1]!);
    await reconnectClient(clients[2]!);
    await waitForRecoveryInactive(host);

    const cleared = host.recoveryEvents.filter((event) => !event.isActive && event.sequence > sequenceBefore);
    assert.ok(cleared.length >= 1, 'recovery cleared event broadcast');

    await sleep(600);
    const lastRecovery = host.recoveryEvents.at(-1);
    assert.equal(lastRecovery?.isActive, false, 'latest recovery state is cleared');

    host.socket.disconnect();
    clients.forEach((c) => c.socket.disconnect());
  });

  await runTest('J fresh player joins room during active match as waiting player', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const joinRes = await ack<{ success: boolean; data?: { player: { id: string } }; error?: { code: string } }>(
      host.socket,
      'join-room',
      {
        roomCode,
        playerName: 'زائر',
      },
    );
    assert.ok(joinRes.success);
    assert.ok(joinRes.data?.player.id);

    const shellRes = await ack<{ success: boolean; data: { state: { matchParticipantIds: string[] | null } } }>(
      host.socket,
      'game-shell-sync',
    );
    assert.ok(shellRes.success);
    assert.ok(shellRes.data.state.matchParticipantIds);
    assert.equal(shellRes.data.state.matchParticipantIds.includes(joinRes.data!.player.id), false);

    host.socket.disconnect();
    clients.forEach((c) => c.socket.disconnect());
  });

  await runTest('N host end game keeps room reconnect tokens valid', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const token = clients[1]!.reconnectToken;

    const endRes = await ack<{ success: boolean }>(host.socket, GAME_SHELL_END_EVENT);
    assert.ok(endRes.success);

    clients[1]!.socket.disconnect();
    await sleep(200);
    clients[1]!.socket = await connectClient();

    const recon = await ack<{ success: boolean }>(clients[1]!.socket, 'reconnect', {
      playerId: clients[1]!.id,
      roomId: clients[1]!.roomId,
      roomCode,
      reconnectToken: token,
    });
    assert.ok(recon.success);

    host.socket.disconnect();
    clients.forEach((c) => c.socket.disconnect());
  });

  await runTest('presence: disconnect marks DISCONNECTED; reconnect stays CONNECTED', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const target = clients[1]!;
    const playerId = target.id;
    const token = target.reconnectToken;
    let latestPlayers: Array<{ id: string; status: string }> = [];

    const onSnapshot = (payload: { players: Array<{ id: string; status: string }> }) => {
      latestPlayers = payload.players;
    };
    host.socket.on('room-players-snapshot', onSnapshot);

    target.socket.disconnect();

    await waitFor(
      async () => {
        const entry = latestPlayers.find((player) => player.id === playerId);
        return entry?.status === 'DISCONNECTED' ? entry : null;
      },
      4000,
      'target marked DISCONNECTED',
    );

    target.socket = await connectClient();
    trackClientEvents(target);

    const res = await ack<{
      success: boolean;
      data: { player: { id: string; status: string }; players: Array<{ id: string; status: string }> };
    }>(target.socket, 'reconnect', {
      playerId,
      roomId: target.roomId,
      roomCode,
      reconnectToken: token,
    });

    assert.ok(res.success);
    assert.equal(res.data.player.id, playerId);
    assert.equal(res.data.player.status, 'CONNECTED');
    assert.equal(
      res.data.players.filter((player) => player.id === playerId).length,
      1,
      'no duplicate player after reconnect',
    );

    // Allow any late force-disconnect handlers to run; status must remain CONNECTED.
    await sleep(400);
    await waitFor(
      async () => {
        const entry = latestPlayers.find((player) => player.id === playerId);
        return entry?.status === 'CONNECTED' ? entry : null;
      },
      4000,
      'target remains CONNECTED after reconnect race',
    );

    host.socket.off('room-players-snapshot', onSnapshot);
    host.socket.disconnect();
    clients.forEach((client) => client.socket.disconnect());
  });

  await runTest('presence: explicit leave removes player from active roster', async () => {
    const { host, clients, roomCode } = await startThreePlayerMatch();
    const leaver = clients[1]!;
    const leaverId = leaver.id;
    let latestPlayers: Array<{ id: string }> = [];

    const onSnapshot = (payload: { players: Array<{ id: string }> }) => {
      latestPlayers = payload.players;
    };
    host.socket.on('room-players-snapshot', onSnapshot);

    const leaveRes = await ack<{ success: boolean }>(leaver.socket, 'leave-room');
    assert.ok(leaveRes.success);

    await waitFor(
      async () => (latestPlayers.every((player) => player.id !== leaverId) ? latestPlayers : null),
      4000,
      'leaver removed from active roster',
    );

    leaver.socket.disconnect();
    await sleep(150);
    leaver.socket = await connectClient();

    const joinRes = await ack<{
      success: boolean;
      data: { player: { id: string }; players: Array<{ id: string }> };
    }>(leaver.socket, 'join-room', {
      roomCode,
      playerName: `${leaver.name}-new`,
    });
    assert.ok(joinRes.success);
    assert.notEqual(joinRes.data.player.id, leaverId);

    host.socket.off('room-players-snapshot', onSnapshot);
    host.socket.disconnect();
    clients.forEach((client) => client.socket.disconnect());
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('reconnect suite crashed:', error);
  process.exit(1);
});
