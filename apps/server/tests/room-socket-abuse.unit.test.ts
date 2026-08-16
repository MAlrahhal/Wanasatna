/**
 * P10-B.2 room/socket abuse hardening.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/room-socket-abuse.unit.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server, Socket } from 'socket.io';
import {
  CREATE_ROOM_EVENT,
  GAME_SHELL_SYNC_EVENT,
  JOIN_ROOM_EVENT,
  RECONNECT_EVENT,
  ROOM_SYNC_EVENT,
} from '@wanasatna/shared';
import { getClientIp } from '../src/lib/client-ip.js';
import {
  abuseLimiterBucketCounts,
  consumeConnectLimit,
  consumeCreateRoomLimit,
  consumeGameSyncLimit,
  consumeJoinRoomLimit,
  consumeReconnectLimit,
  consumeRoomSyncLimit,
  forgetSocketAbuseState,
  resetAbuseLimiterForTests,
  setAbuseLimiterNow,
  sweepIdleAbuseBuckets,
} from '../src/lib/abuse-limiter.js';
import { SOCKET_MAX_HTTP_BUFFER_SIZE } from '../src/lib/socket-limits.js';
import {
  bindNewIdentityOrAbandon,
  rateLimitedGameError,
} from '../src/modules/room/room-abuse.js';
import { resetRoomEntryLocksForTests, withRoomEntryLock } from '../src/modules/room/room-entry-lock.js';
import {
  restoreRoomMutationRuntimeForTests,
  roomMutationRuntime,
} from '../src/modules/room/room-mutation-runtime.js';
import {
  registerCreateRoomHandler,
  registerJoinRoomHandler,
  registerReconnectHandler,
  registerRoomSyncHandler,
} from '../src/modules/room/room.socket.handlers.js';
import { rejectIfGameSyncRateLimited } from '../src/modules/game/game.socket.utils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>): void {
  tests.push({ name, fn });
}

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function handlerBlock(source: string, eventConst: string): string {
  const match = new RegExp(`socket\\.on\\(\\s*${eventConst}`).exec(source);
  assert.ok(match && match.index >= 0, `missing handler ${eventConst}`);
  const start = match.index;
  const rest = source.slice(start + match[0].length);
  const next = rest.search(/socket\.on\(/);
  return next === -1 ? source.slice(start) : source.slice(start, start + match[0].length + next);
}

type FakeSocket = Socket & {
  handlers: Map<string, (payload: unknown, callback?: (response: unknown) => void) => unknown>;
};

function fakeSocket(id: string, ip: string): FakeSocket {
  const handlers = new Map<
    string,
    (payload: unknown, callback?: (response: unknown) => void) => unknown
  >();

  const socket = {
    id,
    connected: true,
    data: {} as { playerId?: string; roomId?: string },
    handshake: { headers: { 'x-real-ip': ip }, address: ip },
    conn: { remoteAddress: ip },
    handlers,
    on(event: string, fn: (payload: unknown, callback?: (response: unknown) => void) => unknown) {
      handlers.set(event, fn);
      return socket;
    },
    join: async () => undefined,
    leave: async () => undefined,
    emit: () => undefined,
  };

  return socket as unknown as FakeSocket;
}

function emitAck(socket: FakeSocket, event: string, payload: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const handler = socket.handlers.get(event);
    if (!handler) {
      reject(new Error(`missing handler ${event}`));
      return;
    }

    void handler(payload, resolve);
  });
}

const fakeIo = {
  in: () => ({ fetchSockets: async () => [] }),
  to: () => ({ emit: () => undefined }),
} as unknown as Server;

function sessionOk(roomId = 'room-1', playerId = 'player-1', code = '123456') {
  return {
    success: true as const,
    data: {
      room: { id: roomId, code, hostPlayerId: playerId, isLocked: false, status: 'LOBBY' },
      player: { id: playerId, name: 'محمد', status: 'CONNECTED', isHost: true },
      players: [],
      reconnectToken: 'r'.repeat(32),
    },
  };
}

function setupRuntimeMocks() {
  resetAbuseLimiterForTests();
  resetRoomEntryLocksForTests();
  restoreRoomMutationRuntimeForTests();
  roomMutationRuntime.bindSocketToRoomSession = async (socket, roomId, playerId) => {
    socket.data.roomId = roomId;
    socket.data.playerId = playerId;
  };
  roomMutationRuntime.clearSocketSession = async (socket) => {
    socket.data.playerId = undefined;
    socket.data.roomId = undefined;
  };
  roomMutationRuntime.leaveRoom = async () => ({
    success: true,
    data: { roomDeleted: true, hostChanged: null },
  });
  roomMutationRuntime.announcePermanentPlayerRemoval = async () => undefined;
  roomMutationRuntime.broadcastRoomPlayersSnapshot = async () => undefined;
  roomMutationRuntime.onRoomRosterJoined = async () => undefined;
  roomMutationRuntime.handlePlayerDisconnect = async () => undefined;
  roomMutationRuntime.loadActiveRoomPlayers = async () => [];
}

test('X-Real-IP is used only when it is a single valid address', () => {
  const socket = fakeSocket('s1', '203.0.113.9');
  assert.equal(getClientIp(socket), '203.0.113.9');

  socket.handshake.headers['x-real-ip'] = '203.0.113.9, 10.0.0.1';
  socket.handshake.address = '198.51.100.2';
  assert.equal(getClientIp(socket), '198.51.100.2');

  socket.handshake.headers['x-real-ip'] = 'not-an-ip';
  socket.handshake.address = '::ffff:198.51.100.7';
  assert.equal(getClientIp(socket), '198.51.100.7');
});

test('CREATE per-socket burst then reject, refill, independent IP', async () => {
  setupRuntimeMocks();
  let now = 1_000_000;
  setAbuseLimiterNow(() => now);

  const socket = fakeSocket('create-a', '203.0.113.10');
  assert.equal(consumeCreateRoomLimit(socket), true);
  assert.equal(consumeCreateRoomLimit(socket), true);
  assert.equal(consumeCreateRoomLimit(socket), true);
  assert.equal(consumeCreateRoomLimit(socket), false);

  now += 20_000;
  assert.equal(consumeCreateRoomLimit(socket), true);

  const otherIp = fakeSocket('create-b', '203.0.113.11');
  assert.equal(consumeCreateRoomLimit(otherIp), true);
});

test('CREATE per-IP quota is shared across sockets', () => {
  setupRuntimeMocks();
  let allowed = 0;
  for (let index = 0; index < 25; index += 1) {
    const socket = fakeSocket(`ip-${index}`, '198.51.100.20');
    if (consumeCreateRoomLimit(socket)) {
      allowed += 1;
    }
  }
  assert.equal(allowed, 20);
});

test('CREATE handler: normal + burst + reject before createRoom + refill', async () => {
  setupRuntimeMocks();
  let now = 2_000_000;
  setAbuseLimiterNow(() => now);
  let createCalls = 0;
  roomMutationRuntime.createRoom = async () => {
    createCalls += 1;
    return sessionOk(`room-${createCalls}`, `player-${createCalls}`, String(100000 + createCalls));
  };

  const socket = fakeSocket('h-create', '203.0.113.30');
  registerCreateRoomHandler(fakeIo, socket);

  for (let index = 0; index < 3; index += 1) {
    const response = (await emitAck(socket, CREATE_ROOM_EVENT, { playerName: 'محمد' })) as {
      success: boolean;
    };
    assert.equal(response.success, true);
  }
  assert.equal(createCalls, 3);

  const limited = (await emitAck(socket, CREATE_ROOM_EVENT, { playerName: 'محمد' })) as {
    success: boolean;
    error?: { code: string };
  };
  assert.equal(limited.success, false);
  assert.equal(limited.error?.code, 'RATE_LIMITED');
  assert.equal(createCalls, 3);

  now += 60_000;
  const after = (await emitAck(socket, CREATE_ROOM_EVENT, { playerName: 'محمد' })) as {
    success: boolean;
  };
  assert.equal(after.success, true);
  assert.equal(createCalls, 4);
});

test('JOIN invalid codes rate-limit before joinRoom/DB', async () => {
  setupRuntimeMocks();
  let now = 3_000_000;
  setAbuseLimiterNow(() => now);
  let joinCalls = 0;
  roomMutationRuntime.joinRoom = async () => {
    joinCalls += 1;
    return { success: false, error: { code: 'ROOM_NOT_FOUND', message: 'missing' } };
  };

  const socket = fakeSocket('h-join', '203.0.113.40');
  registerJoinRoomHandler(fakeIo, socket);

  for (let index = 0; index < 20; index += 1) {
    const response = (await emitAck(socket, JOIN_ROOM_EVENT, {
      playerName: 'خالد',
      roomCode: String(100000 + (index % 50)).padStart(6, '0'),
    })) as { success: boolean; error?: { code: string } };
    assert.equal(response.success, false);
    assert.equal(response.error?.code, 'ROOM_NOT_FOUND');
  }
  assert.equal(joinCalls, 20);

  const limited = (await emitAck(socket, JOIN_ROOM_EVENT, {
    playerName: 'خالد',
    roomCode: '000000',
  })) as { success: boolean; error?: { code: string } };
  assert.equal(limited.error?.code, 'RATE_LIMITED');
  assert.equal(joinCalls, 20);

  now += 60_000;
  const after = (await emitAck(socket, JOIN_ROOM_EVENT, {
    playerName: 'خالد',
    roomCode: '000001',
  })) as { error?: { code: string } };
  assert.equal(after.error?.code, 'ROOM_NOT_FOUND');
  assert.equal(joinCalls, 21);
});

test('RECONNECT spam is rejected before reconnectPlayer; burst stays under quota', async () => {
  setupRuntimeMocks();
  setAbuseLimiterNow(() => 4_000_000);
  let reconnectCalls = 0;
  roomMutationRuntime.reconnectPlayer = async () => {
    reconnectCalls += 1;
    return sessionOk();
  };

  const socket = fakeSocket('h-re', '203.0.113.50');
  registerReconnectHandler(fakeIo, socket);
  const payload = {
    playerId: 'player-1',
    reconnectToken: 't'.repeat(32),
    roomId: 'room-1',
  };

  for (let index = 0; index < 30; index += 1) {
    const response = (await emitAck(socket, RECONNECT_EVENT, payload)) as { success: boolean };
    assert.equal(response.success, true);
  }
  assert.equal(reconnectCalls, 30);

  const limited = (await emitAck(socket, RECONNECT_EVENT, payload)) as {
    success: boolean;
    error?: { code: string };
  };
  assert.equal(limited.success, false);
  assert.equal(limited.error?.code, 'RATE_LIMITED');
  assert.equal(reconnectCalls, 30);
});

test('ROOM_SYNC excess is rejected before Prisma work and ACKs immediately', async () => {
  setupRuntimeMocks();
  let syncCalls = 0;
  roomMutationRuntime.syncBoundRoomSession = async () => {
    syncCalls += 1;
    return sessionOk();
  };

  const socket = fakeSocket('h-sync', '203.0.113.60');
  socket.data.playerId = 'player-1';
  socket.data.roomId = 'room-1';
  registerRoomSyncHandler(fakeIo, socket);

  const started = Date.now();
  for (let index = 0; index < 4; index += 1) {
    const response = (await emitAck(socket, ROOM_SYNC_EVENT, {})) as { success: boolean };
    assert.equal(response.success, true);
  }
  const limited = (await emitAck(socket, ROOM_SYNC_EVENT, {})) as {
    success: boolean;
    error?: { code: string };
  };
  assert.ok(Date.now() - started < 1000);
  assert.equal(limited.error?.code, 'RATE_LIMITED');
  assert.equal(syncCalls, 4);
});

test('GAME/PLUGIN SYNC share one budget; excess does not build a view', () => {
  setupRuntimeMocks();
  const socket = fakeSocket('h-gsync', '203.0.113.70');
  let views = 0;
  const callback = (response: unknown) => {
    const typed = response as { success: boolean; error?: { code: string } };
    if (!typed.success) {
      assert.equal(typed.error?.code, 'RATE_LIMITED');
    }
  };

  for (let index = 0; index < 4; index += 1) {
    assert.equal(rejectIfGameSyncRateLimited(socket, callback), false);
    views += 1;
  }
  assert.equal(rejectIfGameSyncRateLimited(socket, callback), true);
  assert.equal(views, 4);
  assert.equal(consumeGameSyncLimit(socket), false);
  assert.equal(rateLimitedGameError().error.code, 'RATE_LIMITED');
});

test('CREATE+CREATE / CREATE+JOIN / JOIN+JOIN: only one mutation proceeds', async () => {
  setupRuntimeMocks();
  let createCalls = 0;
  let joinCalls = 0;
  let releaseCreate: () => void = () => undefined;
  const createGate = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });

  roomMutationRuntime.createRoom = async () => {
    createCalls += 1;
    await createGate;
    return sessionOk('room-a', 'player-a');
  };
  roomMutationRuntime.joinRoom = async () => {
    joinCalls += 1;
    return sessionOk('room-b', 'player-b', '654321');
  };

  const socket = fakeSocket('race-1', '203.0.113.80');
  registerCreateRoomHandler(fakeIo, socket);
  registerJoinRoomHandler(fakeIo, socket);

  const first = emitAck(socket, CREATE_ROOM_EVENT, { playerName: 'محمد' });
  const secondCreate = emitAck(socket, CREATE_ROOM_EVENT, { playerName: 'خالد' });
  const secondJoin = emitAck(socket, JOIN_ROOM_EVENT, { playerName: 'خالد', roomCode: '123456' });

  const secondCreateRes = (await secondCreate) as { error?: { code: string } };
  const secondJoinRes = (await secondJoin) as { error?: { code: string } };
  assert.equal(secondCreateRes.error?.code, 'ROOM_ENTRY_IN_PROGRESS');
  assert.equal(secondJoinRes.error?.code, 'ROOM_ENTRY_IN_PROGRESS');
  assert.equal(createCalls, 1);
  assert.equal(joinCalls, 0);

  releaseCreate();
  const firstRes = (await first) as { success: boolean };
  assert.equal(firstRes.success, true);
});

test('JOIN+JOIN: second is busy while first is in flight', async () => {
  setupRuntimeMocks();
  let joinCalls = 0;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  roomMutationRuntime.joinRoom = async () => {
    joinCalls += 1;
    await gate;
    return sessionOk('room-j', 'player-j', '111111');
  };

  const socket = fakeSocket('race-join', '203.0.113.81');
  registerJoinRoomHandler(fakeIo, socket);
  const first = emitAck(socket, JOIN_ROOM_EVENT, { playerName: 'محمد', roomCode: '111111' });
  const second = emitAck(socket, JOIN_ROOM_EVENT, { playerName: 'خالد', roomCode: '222222' });
  const secondRes = (await second) as { error?: { code: string } };
  assert.equal(secondRes.error?.code, 'ROOM_ENTRY_IN_PROGRESS');
  assert.equal(joinCalls, 1);
  release();
  assert.equal(((await first) as { success: boolean }).success, true);
});

test('entry lock releases on throw so the next request can proceed', async () => {
  resetRoomEntryLocksForTests();
  await assert.rejects(
    withRoomEntryLock('lock-1', async () => {
      throw new Error('boom');
    }),
  );
  const again = await withRoomEntryLock('lock-1', async () => 'ok');
  assert.equal(again.ok, true);
  assert.equal(again.ok ? again.value : null, 'ok');
});

test('mid-entry disconnect abandons CREATE/JOIN identities', async () => {
  setupRuntimeMocks();
  const abandoned: string[] = [];
  roomMutationRuntime.createRoom = async () => sessionOk('room-c', 'player-c');
  roomMutationRuntime.joinRoom = async () => sessionOk('room-j', 'player-j', '222222');
  roomMutationRuntime.leaveRoom = async (playerId, roomId) => {
    abandoned.push(`${playerId}:${roomId}`);
    return { success: true, data: { roomDeleted: true, hostChanged: null } };
  };

  const createSocket = fakeSocket('disc-c', '203.0.113.90');
  registerCreateRoomHandler(fakeIo, createSocket);
  roomMutationRuntime.createRoom = async () => {
    createSocket.connected = false;
    return sessionOk('room-c', 'player-c');
  };
  const createRes = (await emitAck(createSocket, CREATE_ROOM_EVENT, { playerName: 'محمد' })) as {
    error?: { code: string };
  };
  assert.equal(createRes.error?.code, 'CONNECTION_FAILED');
  assert.deepEqual(abandoned, ['player-c:room-c']);
  assert.equal(createSocket.data.playerId, undefined);

  abandoned.length = 0;
  const joinSocket = fakeSocket('disc-j', '203.0.113.91');
  registerJoinRoomHandler(fakeIo, joinSocket);
  roomMutationRuntime.joinRoom = async () => {
    joinSocket.connected = false;
    return sessionOk('room-j', 'player-j', '222222');
  };
  const joinRes = (await emitAck(joinSocket, JOIN_ROOM_EVENT, {
    playerName: 'خالد',
    roomCode: '222222',
  })) as { error?: { code: string } };
  assert.equal(joinRes.error?.code, 'CONNECTION_FAILED');
  assert.deepEqual(abandoned, ['player-j:room-j']);
});

test('bindNewIdentityOrAbandon leaves when the socket drops after bind', async () => {
  const socket = fakeSocket('bind-drop', '203.0.113.92');
  let abandoned = false;
  const result = await bindNewIdentityOrAbandon(
    socket,
    'room-1',
    'player-1',
    async (current) => {
      current.data.playerId = 'player-1';
      current.data.roomId = 'room-1';
      current.connected = false;
    },
    async () => {
      abandoned = true;
    },
    async (current) => {
      current.data.playerId = undefined;
      current.data.roomId = undefined;
    },
  );
  assert.equal(result, 'abandoned');
  assert.equal(abandoned, true);
  assert.equal(socket.data.playerId, undefined);
});

test('sequential Room A → Room B detaches the prior identity', async () => {
  setupRuntimeMocks();
  const left: string[] = [];
  roomMutationRuntime.leaveRoom = async (playerId, roomId) => {
    left.push(`${playerId}:${roomId}`);
    return { success: true, data: { roomDeleted: false, hostChanged: null } };
  };
  roomMutationRuntime.createRoom = async () => sessionOk('room-b', 'player-b', '333333');

  const socket = fakeSocket('seq', '203.0.113.93');
  socket.data.playerId = 'player-a';
  socket.data.roomId = 'room-a';
  registerCreateRoomHandler(fakeIo, socket);
  const response = (await emitAck(socket, CREATE_ROOM_EVENT, { playerName: 'نورة' })) as {
    success: boolean;
  };
  assert.equal(response.success, true);
  assert.deepEqual(left, ['player-a:room-a']);
  assert.equal(socket.data.roomId, 'room-b');
  assert.equal(socket.data.playerId, 'player-b');
});

test('idle IP/socket buckets expire; disconnect forgets socket buckets', () => {
  setupRuntimeMocks();
  let now = 4_000_000;
  setAbuseLimiterNow(() => now);
  const socket = fakeSocket('idle', '203.0.113.94');
  assert.equal(consumeCreateRoomLimit(socket), true);
  assert.equal(abuseLimiterBucketCounts().sockets, 1);
  assert.equal(abuseLimiterBucketCounts().ips, 1);
  forgetSocketAbuseState(socket.id);
  assert.equal(abuseLimiterBucketCounts().sockets, 0);
  now += 130_000;
  sweepIdleAbuseBuckets(now);
  assert.equal(abuseLimiterBucketCounts().ips, 0);
});

test('connection-attempt IP limiter has high headroom then rejects', () => {
  setupRuntimeMocks();
  const socket = fakeSocket('conn', '203.0.113.95');
  let allowed = 0;
  for (let index = 0; index < 130; index += 1) {
    if (consumeConnectLimit(socket)) {
      allowed += 1;
    }
  }
  assert.equal(allowed, 120);
});

test('maxHttpBufferSize is explicit and well above a legal drawing batch', () => {
  assert.equal(SOCKET_MAX_HTTP_BUFFER_SIZE, 64 * 1024);
  const sockets = read('src/sockets/index.ts');
  assert.match(sockets, /maxHttpBufferSize: SOCKET_MAX_HTTP_BUFFER_SIZE/);
  assert.ok(SOCKET_MAX_HTTP_BUFFER_SIZE > 64 * 40);
});

const roomHandlers = read('src/modules/room/room.socket.handlers.ts');
const shellHandlers = read('src/modules/game/game.socket.handlers.ts');

test('CREATE/JOIN/RECONNECT/SYNC rate-limit before mutation/DB', () => {
  const create = handlerBlock(roomHandlers, 'CREATE_ROOM_EVENT');
  assert.ok(create.indexOf('consumeCreateRoomLimit') < create.indexOf('roomMutationRuntime.createRoom'));
  const join = handlerBlock(roomHandlers, 'JOIN_ROOM_EVENT');
  assert.ok(join.indexOf('consumeJoinRoomLimit') < join.indexOf('roomMutationRuntime.joinRoom'));
  const reconnect = handlerBlock(roomHandlers, 'RECONNECT_EVENT');
  assert.ok(
    reconnect.indexOf('consumeReconnectLimit') < reconnect.indexOf('roomMutationRuntime.reconnectPlayer'),
  );
  const sync = handlerBlock(roomHandlers, 'ROOM_SYNC_EVENT');
  assert.ok(sync.indexOf('consumeRoomSyncLimit') < sync.indexOf('syncBoundRoomSession'));
});

test('GAME_SHELL_SYNC is caller-only; mutations still broadcast', () => {
  const sync = handlerBlock(shellHandlers, 'GAME_SHELL_SYNC_EVENT');
  assert.match(sync, /rejectIfGameSyncRateLimited/);
  assert.match(sync, /socket\.emit\(GAME_SHELL_STATE_EVENT/);
  assert.doesNotMatch(sync, /broadcastGameShellState/);

  const ready = handlerBlock(shellHandlers, 'GAME_SHELL_SET_READY_EVENT');
  assert.match(ready, /broadcastGameShellState/);
});

for (const [file, eventConst, viewNeedle] of [
  ['src/modules/game/plugins/draw-guess/socket.handlers.ts', 'DRAW_GUESS_SYNC_EVENT', 'buildDrawGuess'],
  ['src/modules/game/plugins/imposter-draw/socket.handlers.ts', 'IMPOSTER_DRAW_SYNC_EVENT', 'buildImposterDraw'],
  ['src/modules/game/plugins/bara-al-salafa/socket.handlers.ts', 'BARA_AL_SALAFA_SYNC_EVENT', 'buildBaraAlSalafa'],
  ['src/modules/game/plugins/fast-answer/socket.handlers.ts', 'FAST_ANSWER_SYNC_EVENT', 'respondWithView'],
  ['src/modules/game/plugins/timing-challenge/socket.handlers.ts', 'TIMING_CHALLENGE_SYNC_EVENT', 'buildTimingChallenge'],
  ['src/modules/game/plugins/who-wrote-it/socket.handlers.ts', 'WHO_WROTE_IT_SYNC_EVENT', 'respondWithView'],
  ['src/modules/game/plugins/judge/socket.handlers.ts', 'JUDGE_SYNC_EVENT', 'respondWithView'],
  ['src/modules/game/plugins/guessing-challenge/socket.handlers.ts', 'GUESSING_CHALLENGE_SYNC_EVENT', 'respondWithView'],
] as const) {
  test(`${eventConst} applies shared game-sync budget before view build`, () => {
    const source = read(file);
    const block = handlerBlock(source, eventConst);
    assert.ok(block.indexOf('rejectIfGameSyncRateLimited') < block.indexOf(viewNeedle));
  });
}

void (async () => {
  let passed = 0;
  let failed = 0;

  for (const entry of tests) {
    try {
      await entry.fn();
      passed += 1;
      console.log(`PASS ${entry.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${entry.name}`);
      console.error(error instanceof Error ? error.stack ?? error.message : error);
    }
  }

  restoreRoomMutationRuntimeForTests();
  resetAbuseLimiterForTests();
  resetRoomEntryLocksForTests();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
})();
