/**
 * Direct PRODUCTION Socket.IO isolation audit.
 * Connects to the real Railway server origin used by wanasatna.com.
 *
 * Usage:
 *   pnpm --filter @wanasatna/server exec tsx tests/production-isolation.audit.ts
 *
 * Optional:
 *   WANASATNA_PROD_SERVER_URL=https://... tsx ...
 *
 * Never prints reconnect tokens.
 */
import assert from 'node:assert/strict';
import { io as ioClient, type Socket } from 'socket.io-client';

const PROD_SERVER_URL =
  process.env.WANASATNA_PROD_SERVER_URL?.trim() ||
  'https://wanasatnaserver-production.up.railway.app';

type Ack<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

type SessionData = {
  room: { id: string; code: string; status?: string };
  player: { id: string; name: string; isHost?: boolean };
  players: Array<{ id: string; name: string; status: string; isHost: boolean }>;
  reconnectToken?: string;
};

function log(step: string, details: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ step, ...details }));
}

function ack<T>(socket: Socket, event: string, payload: unknown = {}): Promise<Ack<T>> {
  return new Promise((resolve, reject) => {
    socket.timeout(20000).emit(event, payload, (err: Error | null, res: Ack<T>) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(res);
    });
  });
}

async function connect(label: string): Promise<Socket> {
  const socket = ioClient(PROD_SERVER_URL, {
    autoConnect: true,
    transports: ['websocket', 'polling'],
  });

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error) => reject(error));
  });

  log('socket-connected', { label, socketId: socket.id, server: PROD_SERVER_URL });
  return socket;
}

async function fetchVersion(): Promise<unknown> {
  try {
    const response = await fetch(`${PROD_SERVER_URL}/api/version`);
    if (!response.ok) {
      return { available: false, status: response.status };
    }
    return { available: true, body: await response.json() };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  log('audit-start', { server: PROD_SERVER_URL });
  log('api-version', { result: await fetchVersion() });

  const a = await connect('A');
  const b = await connect('B');

  const createA = await ack<SessionData>(a, 'create-room', { playerName: 'محمد' });
  log('create-A', {
    success: createA.success,
    error: createA.success ? undefined : createA.error,
    roomCode: createA.success ? createA.data.room.code : undefined,
    roomId: createA.success ? createA.data.room.id : undefined,
    hostName: createA.success ? createA.data.player.name : undefined,
    hostId: createA.success ? createA.data.player.id : undefined,
    roster: createA.success ? createA.data.players.map((p) => p.name) : undefined,
  });
  assert.equal(createA.success, true, 'create محمد must succeed');
  assert.equal(createA.data.player.name, 'محمد');

  const roomACode = createA.data.room.code;
  const roomAId = createA.data.room.id;
  const hostAId = createA.data.player.id;

  const joinA = await ack<SessionData>(b, 'join-room', {
    roomCode: roomACode,
    playerName: 'خالد',
  });
  log('join-A', {
    success: joinA.success,
    error: joinA.success ? undefined : joinA.error,
    roomCode: joinA.success ? joinA.data.room.code : undefined,
    playerName: joinA.success ? joinA.data.player.name : undefined,
    playerId: joinA.success ? joinA.data.player.id : undefined,
    roster: joinA.success ? joinA.data.players.map((p) => p.name) : undefined,
  });
  assert.equal(joinA.success, true, 'join خالد must succeed');
  assert.equal(joinA.data.player.name, 'خالد');
  assert.equal(joinA.data.room.code, roomACode);
  const guestAId = joinA.data.player.id;

  const leaveB = await ack<{ roomDeleted: boolean }>(b, 'leave-room', {});
  log('leave-B', { success: leaveB.success, error: leaveB.success ? undefined : leaveB.error });
  assert.equal(leaveB.success, true);

  const leaveA = await ack<{ roomDeleted: boolean }>(a, 'leave-room', {});
  log('leave-A', {
    success: leaveA.success,
    roomDeleted: leaveA.success ? leaveA.data.roomDeleted : undefined,
    error: leaveA.success ? undefined : leaveA.error,
  });
  assert.equal(leaveA.success, true);

  // Fresh create as خلود on same socket A (production reuse path).
  const createB = await ack<SessionData>(a, 'create-room', { playerName: 'خلود' });
  log('create-B-خلود', {
    success: createB.success,
    error: createB.success ? undefined : createB.error,
    roomCode: createB.success ? createB.data.room.code : undefined,
    roomId: createB.success ? createB.data.room.id : undefined,
    hostName: createB.success ? createB.data.player.name : undefined,
    hostId: createB.success ? createB.data.player.id : undefined,
    roster: createB.success ? createB.data.players.map((p) => p.name) : undefined,
    differsFromRoomA: createB.success
      ? {
          roomCode: createB.data.room.code !== roomACode,
          roomId: createB.data.room.id !== roomAId,
          hostId: createB.data.player.id !== hostAId,
        }
      : undefined,
  });
  assert.equal(createB.success, true, 'create خلود must succeed');
  assert.equal(createB.data.player.name, 'خلود', 'ACK host name must be خلود');
  assert.notEqual(createB.data.room.code, roomACode);
  assert.notEqual(createB.data.player.id, hostAId);

  const roomBCode = createB.data.room.code;
  const roomBId = createB.data.room.id;
  const hostBId = createB.data.player.id;

  const joinB = await ack<SessionData>(b, 'join-room', {
    roomCode: roomBCode,
    playerName: 'عبدالله',
  });
  log('join-B-عبدالله', {
    success: joinB.success,
    error: joinB.success ? undefined : joinB.error,
    roomCode: joinB.success ? joinB.data.room.code : undefined,
    roomId: joinB.success ? joinB.data.room.id : undefined,
    playerName: joinB.success ? joinB.data.player.name : undefined,
    playerId: joinB.success ? joinB.data.player.id : undefined,
    roster: joinB.success ? joinB.data.players.map((p) => p.name) : undefined,
    differsFromGuestA: joinB.success ? joinB.data.player.id !== guestAId : undefined,
  });
  assert.equal(joinB.success, true, 'join عبدالله must succeed against Room B code');
  assert.equal(joinB.data.player.name, 'عبدالله');
  assert.equal(joinB.data.room.code, roomBCode);
  assert.equal(joinB.data.room.id, roomBId);
  assert.notEqual(joinB.data.player.id, guestAId);

  const names = new Set(joinB.data.players.map((p) => p.name));
  assert.ok(names.has('خلود'), 'roster must include خلود');
  assert.ok(names.has('عبدالله'), 'roster must include عبدالله');
  assert.equal(names.has('محمد'), false);
  assert.equal(names.has('خالد'), false);

  // Cleanup
  await ack(b, 'leave-room', {});
  await ack(a, 'leave-room', {});
  a.disconnect();
  b.disconnect();

  log('PRODUCTION_SERVER_DIRECT_TEST', {
    result: 'PASS',
    roomACode,
    roomBCode,
    hostBName: 'خلود',
    hostBId,
  });
  console.log('PASS production isolation direct Socket.IO test');
}

main().catch((error) => {
  log('PRODUCTION_SERVER_DIRECT_TEST', {
    result: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error('FAIL', error);
  process.exit(1);
});
