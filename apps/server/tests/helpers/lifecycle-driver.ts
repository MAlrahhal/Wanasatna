import assert from 'node:assert/strict';
import {
  BARA_AL_SALAFA_GAME_ID,
  BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT,
  GAME_SHELL_END_EVENT,
  GAME_SHELL_PLAYER_RECOVERY_EVENT,
} from '@wanasatna/shared';
import {
  ack,
  connectClient,
  sleep,
  syncView,
  trackClientEvents,
  waitFor,
  type TestClient,
} from './socket-utils.js';

const PLAYER_NAMES = ['محمد', 'خالد', 'علي', 'سارة'] as const;

export type LifecycleClients = {
  host: TestClient;
  clients: TestClient[];
  roomCode: string;
};

export async function startMatchWithPlayers(playerCount: number): Promise<LifecycleClients> {
  assert.ok(playerCount >= 3 && playerCount <= 4);

  const clients: TestClient[] = [];
  const names = PLAYER_NAMES.slice(0, playerCount);

  const hostSocket = await connectClient();
  const host: TestClient = {
    name: names[0]!,
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
  trackClientEvents(host);
  clients.push(host);

  const createRes = await ack<{
    success: boolean;
    data: { room: { code: string; id: string }; player: { id: string }; reconnectToken?: string };
  }>(host.socket, 'create-room', { playerName: host.name });
  assert.ok(createRes.success);
  host.id = createRes.data.player.id;
  host.roomId = createRes.data.room.id;
  host.roomCode = createRes.data.room.code;
  host.reconnectToken = createRes.data.reconnectToken ?? '';
  assert.ok(host.reconnectToken);
  const roomCode = createRes.data.room.code;

  for (const name of names.slice(1)) {
    const socket = await connectClient();
    const client: TestClient = {
      name,
      socket,
      id: '',
      roomId: '',
      roomCode,
      reconnectToken: '',
      shellEvents: [],
      roster: [],
      rosterPlayers: [],
      navigations: [],
      recoveryEvents: [],
    };
    trackClientEvents(client);
    const joinRes = await ack<{ success: boolean; data: { player: { id: string }; room: { id: string }; reconnectToken?: string } }>(
      client.socket,
      'join-room',
      { roomCode, playerName: name },
    );
    assert.ok(joinRes.success);
    client.id = joinRes.data.player.id;
    client.roomId = joinRes.data.room.id;
    client.reconnectToken = joinRes.data.reconnectToken ?? '';
    assert.ok(client.reconnectToken);
    clients.push(client);
  }

  const startRes = await ack<{ success: boolean }>(host.socket, 'game-shell-start-from-lobby', {
    gameId: BARA_AL_SALAFA_GAME_ID,
  });
  assert.ok(startRes.success);

  await waitFor(
    async () =>
      clients.every((c) => c.shellEvents.some((e) => e.phase === 'PLAYING')) ? true : null,
    15000,
    'PLAYING phase',
    200,
  );

  await waitFor(async () => {
    const view = await syncView(host.socket);
    return view.gamePhase === 'description' ? view : null;
  }, 15000, 'description phase');

  for (const client of clients) {
    await ack(client.socket, BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT);
  }

  return { host, clients, roomCode };
}

export async function startThreePlayerMatch(): Promise<LifecycleClients> {
  return startMatchWithPlayers(3);
}

export async function disconnectClient(client: TestClient): Promise<void> {
  client.socket.disconnect();
  await sleep(200);
}

export async function reconnectClient(client: TestClient): Promise<void> {
  client.socket = await connectClient();
  client.shellEvents.length = 0;
  client.recoveryEvents.length = 0;
  trackClientEvents(client);
  const reconRes = await ack<{ success: boolean }>(client.socket, 'reconnect', {
    playerId: client.id,
    roomId: client.roomId,
    roomCode: client.roomCode,
    reconnectToken: client.reconnectToken,
  });
  assert.ok(reconRes.success, 'reconnect succeeds');
}

export async function waitForRecoveryActive(client: TestClient): Promise<void> {
  await waitFor(
    async () => (client.recoveryEvents.some((event) => event.isActive) ? true : null),
    5000,
    'recovery active',
    100,
  );
}

export async function waitForRecoveryInactive(client: TestClient): Promise<void> {
  await waitFor(
    async () =>
      client.recoveryEvents.some((event) => !event.isActive && event.remainingSeconds === 0)
        ? true
        : null,
    5000,
    'recovery inactive',
    100,
  );
}

export async function assertHostEndGameRejected(client: TestClient): Promise<void> {
  const response = await ack<{ success: boolean; error?: { code: string } }>(
    client.socket,
    GAME_SHELL_END_EVENT,
  );
  assert.equal(response.success, false);
  assert.equal(response.error?.code, 'NOT_HOST');
}

export async function hostEndGame(host: TestClient): Promise<void> {
  const response = await ack<{ success: boolean }>(host.socket, GAME_SHELL_END_EVENT);
  assert.ok(response.success);
}

export function trackRecoveryOnly(client: TestClient): void {
  client.socket.on(GAME_SHELL_PLAYER_RECOVERY_EVENT, (payload) => {
    client.recoveryEvents.push(payload);
  });
}
