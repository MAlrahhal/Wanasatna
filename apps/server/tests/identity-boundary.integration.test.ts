/**
 * Server identity boundary: fresh Create/Join must terminate prior socket RoomPlayer.
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

  // 1) socket bound A → fresh Create B
  const host = emptyClient('محمد');
  host.socket = await connectClient();
  trackClientEvents(host);

  const createA = await ack<{
    success: boolean;
    data: {
      room: { id: string; code: string };
      player: { id: string };
      reconnectToken?: string;
    };
  }>(host.socket, 'create-room', { playerName: 'محمد' });
  assert.ok(createA.success);
  const roomAId = createA.data.room.id;
  const roomACode = createA.data.room.code;
  const playerAId = createA.data.player.id;
  const tokenA = createA.data.reconnectToken ?? '';

  const createB = await ack<{
    success: boolean;
    data: {
      room: { id: string; code: string };
      player: { id: string; name: string };
      reconnectToken?: string;
    };
  }>(host.socket, 'create-room', { playerName: 'خلود' });
  assert.ok(createB.success, 'fresh Create B must succeed while socket was bound to A');
  assert.equal(createB.data.player.name, 'خلود');
  assert.notEqual(createB.data.player.id, playerAId);
  assert.notEqual(createB.data.room.id, roomAId);
  assert.notEqual(createB.data.room.code, roomACode);

  const staleReconnectA = await ack<{ success: boolean; error?: { code: string } }>(
    host.socket,
    'reconnect',
    {
      playerId: playerAId,
      roomId: roomAId,
      roomCode: roomACode,
      reconnectToken: tokenA,
    },
  );
  assert.equal(staleReconnectA.success, false, 'LEFT Room A must not reconnect');

  // Sync should reflect Room B binding after create B (reconnect above may have failed).
  // Re-bind via create response identity by joining... actually socket should still be B.
  // Leave B and re-create cleanly for next cases.
  await ack(host.socket, 'leave-room', {});

  // 2) socket bound A → fresh Join B
  const createA2 = await ack<{
    success: boolean;
    data: { room: { id: string; code: string }; player: { id: string }; reconnectToken?: string };
  }>(host.socket, 'create-room', { playerName: 'محمد' });
  assert.ok(createA2.success);

  const hostB = emptyClient('خلود');
  hostB.socket = await connectClient();
  trackClientEvents(hostB);
  const roomB = await ack<{
    success: boolean;
    data: { room: { id: string; code: string }; player: { id: string } };
  }>(hostB.socket, 'create-room', { playerName: 'خلود' });
  assert.ok(roomB.success);

  const guest = emptyClient('خالد');
  guest.socket = await connectClient();
  trackClientEvents(guest);
  const joinA = await ack<{
    success: boolean;
    data: {
      room: { id: string; code: string };
      player: { id: string };
      reconnectToken?: string;
      players: RosterPlayer[];
    };
  }>(guest.socket, 'join-room', { roomCode: createA2.data.room.code, playerName: 'خالد' });
  assert.ok(joinA.success);
  const guestAId = joinA.data.player.id;
  const guestAToken = joinA.data.reconnectToken ?? '';

  const joinB = await ack<{
    success: boolean;
    data: {
      room: { id: string; code: string };
      player: { id: string; name: string };
      players: RosterPlayer[];
    };
  }>(guest.socket, 'join-room', {
    roomCode: roomB.data.room.code,
    playerName: 'عبدالله',
  });
  assert.ok(joinB.success, 'fresh Join B must succeed while socket was bound to A');
  assert.equal(joinB.data.player.name, 'عبدالله');
  assert.notEqual(joinB.data.player.id, guestAId);
  assert.equal(joinB.data.room.code, roomB.data.room.code);

  await waitFor(
    async () =>
      hostB.rosterPlayers.some((p) => p.id === joinB.data.player.id) ? true : null,
    5000,
    'Room B host sees عبدالله',
  );

  assert.equal(
    hostB.rosterPlayers.some((p) => p.name === 'خالد'),
    false,
    'Room B must not show old Room A name',
  );

  const hijack = await ack<{ success: boolean }>(guest.socket, 'reconnect', {
    playerId: guestAId,
    roomId: createA2.data.room.id,
    roomCode: createA2.data.room.code,
    reconnectToken: guestAToken,
  });
  assert.equal(hijack.success, false, 'disconnected/left A credential cannot hijack after Join B');

  // 3) disconnect (not leave) may reconnect same RoomPlayer
  const discHost = emptyClient('سارة');
  discHost.socket = await connectClient();
  trackClientEvents(discHost);
  const discRoom = await ack<{
    success: boolean;
    data: {
      room: { id: string; code: string };
      player: { id: string };
      reconnectToken?: string;
    };
  }>(discHost.socket, 'create-room', { playerName: 'سارة' });
  assert.ok(discRoom.success);
  const discToken = discRoom.data.reconnectToken ?? '';
  const discPlayerId = discRoom.data.player.id;
  const discRoomId = discRoom.data.room.id;
  const discCode = discRoom.data.room.code;

  discHost.socket.disconnect();
  discHost.socket = await connectClient();
  const re = await ack<{
    success: boolean;
    data: { player: { id: string; name: string }; room: { code: string } };
  }>(discHost.socket, 'reconnect', {
    playerId: discPlayerId,
    roomId: discRoomId,
    roomCode: discCode,
    reconnectToken: discToken,
  });
  assert.ok(re.success, 'temporary disconnect may reconnect same RoomPlayer');
  assert.equal(re.data.player.id, discPlayerId);
  assert.equal(re.data.player.name, 'سارة');

  console.log('PASS identity-boundary create/join/disconnect');
  host.socket.disconnect();
  hostB.socket.disconnect();
  guest.socket.disconnect();
  discHost.socket.disconnect();
}

main().catch((error) => {
  console.error('FAIL', error);
  process.exit(1);
});
