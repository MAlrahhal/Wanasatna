/**
 * Cross-room identity: leave A → join B must not keep A binding/credential.
 */
import assert from 'node:assert/strict';
import {
  ack,
  connectClient,
  trackClientEvents,
  waitFor,
  waitForServer,
  type TestClient,
  type RosterPlayer,
} from './helpers/socket-utils.js';

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

async function main() {
  await waitForServer();

  const hostA = emptyClient('HostA');
  hostA.socket = await connectClient();
  trackClientEvents(hostA);
  const createA = await ack<{
    success: boolean;
    data: {
      room: { id: string; code: string };
      player: { id: string };
      reconnectToken?: string;
      players: RosterPlayer[];
    };
  }>(hostA.socket, 'create-room', { playerName: hostA.name });
  assert.ok(createA.success);
  hostA.id = createA.data.player.id;
  hostA.roomId = createA.data.room.id;
  hostA.roomCode = createA.data.room.code;
  hostA.reconnectToken = createA.data.reconnectToken ?? '';

  const x = emptyClient('Khaled');
  x.socket = await connectClient();
  trackClientEvents(x);
  const joinA = await ack<{
    success: boolean;
    data: {
      room: { id: string };
      player: { id: string };
      reconnectToken?: string;
      players: RosterPlayer[];
    };
  }>(x.socket, 'join-room', { roomCode: hostA.roomCode, playerName: x.name });
  assert.ok(joinA.success);
  x.id = joinA.data.player.id;
  x.roomId = joinA.data.room.id;
  x.roomCode = hostA.roomCode;
  const tokenA = joinA.data.reconnectToken ?? '';

  await waitFor(
    async () => (hostA.rosterPlayers.some((p) => p.id === x.id) ? true : null),
    5000,
    'hostA sees X',
  );

  const leave = await ack<{ success: boolean }>(x.socket, 'leave-room', {});
  assert.ok(leave.success);

  await waitFor(
    async () => (!hostA.rosterPlayers.some((p) => p.id === x.id) ? true : null),
    5000,
    'hostA drops X after leave',
  );

  // Stale Room A reconnect must fail after leave.
  const stale = await ack<{ success: boolean; error?: { code: string } }>(x.socket, 'reconnect', {
    playerId: x.id,
    roomId: x.roomId,
    roomCode: x.roomCode,
    reconnectToken: tokenA,
  });
  assert.equal(stale.success, false);

  const hostB = emptyClient('HostB');
  hostB.socket = await connectClient();
  trackClientEvents(hostB);
  const createB = await ack<{
    success: boolean;
    data: {
      room: { id: string; code: string };
      player: { id: string };
      reconnectToken?: string;
    };
  }>(hostB.socket, 'create-room', { playerName: hostB.name });
  assert.ok(createB.success);
  hostB.id = createB.data.player.id;
  hostB.roomId = createB.data.room.id;
  hostB.roomCode = createB.data.room.code;

  const joinB = await ack<{
    success: boolean;
    data: {
      room: { id: string; code: string };
      player: { id: string; name: string };
      players: RosterPlayer[];
      reconnectToken?: string;
    };
  }>(x.socket, 'join-room', { roomCode: hostB.roomCode, playerName: 'Abdullah' });
  assert.ok(joinB.success);
  assert.equal(joinB.data.player.name, 'Abdullah');
  assert.notEqual(joinB.data.player.id, x.id);
  assert.equal(joinB.data.room.code, hostB.roomCode);

  await waitFor(
    async () =>
      hostB.rosterPlayers.some((p) => p.id === joinB.data.player.id) ? true : null,
    5000,
    'hostB sees Abdullah',
  );

  assert.equal(
    hostA.rosterPlayers.some((p) => p.id === joinB.data.player.id),
    false,
    'hostA must not see Room B player',
  );

  console.log('PASS cross-room identity leave A → join B');
  hostA.socket.disconnect();
  hostB.socket.disconnect();
  x.socket.disconnect();
}

main().catch((error) => {
  console.error('FAIL', error);
  process.exit(1);
});
