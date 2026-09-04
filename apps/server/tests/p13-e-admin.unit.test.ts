/**
 * P13-E — Admin-only experimental game settings.
 * Run: pnpm --filter @wanasatna/server test:p13-e
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io as ioClient, type Socket } from 'socket.io-client';
import {
  CREATE_ROOM_EVENT,
  JOIN_ROOM_EVENT,
  UPDATE_ROOM_GAME_SETTINGS_EVENT,
  sanitizeGameSettingPatch,
  sanitizeRoomGameSettings,
  resolveEffectiveGameSettings,
  type CreateRoomResponse,
  type RoomActionResponse,
  type RoomGameSettings,
} from '@wanasatna/shared';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { setSocketServer } from '../src/lib/socket-server.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { stopExpiredAuthSessionCleanup } from '../src/modules/auth/auth-session-cleanup.js';
import { loginUser, logoutAuthSession, registerUser } from '../src/modules/auth/auth.service.js';
import { registerAllGameContent } from '../src/modules/content/index.js';
import { getLoadedGameContent } from '../src/modules/content/registry.js';
import { deleteGameShell, initGameShell } from '../src/modules/game/game.service.js';
import { registerAllGamePlugins } from '../src/modules/game/plugins/index.js';
import { createMatchState as createBaraMatch } from '../src/modules/game/plugins/bara-al-salafa/state.js';
import { createMatchState as createDrawMatch } from '../src/modules/game/plugins/draw-guess/state.js';
import { createMatchState as createImposterMatch } from '../src/modules/game/plugins/imposter-draw/state.js';
import { createMatchState as createFastMatch } from '../src/modules/game/plugins/fast-answer/state.js';
import { createMatchState as createWhoMatch } from '../src/modules/game/plugins/who-wrote-it/state.js';
import { createMatchState as createJudgeMatch } from '../src/modules/game/plugins/judge/state.js';
import {
  createMatchState as createGcMatch,
  requiredPlayerCountForMode,
} from '../src/modules/game/plugins/guessing-challenge/state.js';
import { applyTimingChallengeLobbySettings } from '../src/modules/game/plugins/timing-challenge/socket.handlers.js';
import { getTimingChallengeSettings } from '../src/modules/game/plugins/timing-challenge/store.js';
import { validateStartGameShellFromLobbyPayload } from '../src/modules/game/game.validators.js';
import {
  clearRoomGameSettingsCache,
  hydrateRoomGameSettings,
  setRoomGameSettingsCache,
} from '../src/modules/room/room-game-settings.store.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { leaveRoom } from '../src/modules/room/services/leave-room.service.js';
import { createSocketServer } from '../src/sockets/index.js';
import { stopDisconnectedPlayerExpirySweep } from '../src/modules/room/services/disconnected-player-expiry.service.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

registerAllGameContent();
registerAllGamePlugins();

let passed = 0;
let failed = 0;

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  }
}

function uniqueEmail(prefix: string): string {
  return `p13e.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

function uniqueName(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 900 + 100)}`;
}

async function cleanupEmail(email: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
}

async function cleanupRoom(roomId: string | undefined): Promise<void> {
  if (!roomId) {
    return;
  }
  deleteGameShell(roomId);
  clearRoomGameSettingsCache(roomId);
  await prisma.match.deleteMany({ where: { roomId } }).catch(() => undefined);
  await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
}

async function registerAccount(prefix: string) {
  const email = uniqueEmail(prefix);
  const registered = await registerUser({
    email,
    password: 'password-ok',
    preferredDisplayName: uniqueName('اسم'),
  });
  assert.equal(registered.success, true);
  if (!registered.success || !registered.session) {
    throw new Error('register failed');
  }
  return { email, user: registered.session.user, sessionToken: registered.session.sessionToken };
}

async function promoteAccount(account: Awaited<ReturnType<typeof registerAccount>>) {
  await promoteExistingUserToAdmin(account.email);
  const loggedIn = await loginUser({ email: account.email, password: 'password-ok' });
  assert.equal(loggedIn.success, true);
  if (!loggedIn.success || !loggedIn.session) {
    throw new Error('post-promotion login failed');
  }
  return {
    email: account.email,
    user: loggedIn.session.user,
    sessionToken: loggedIn.session.sessionToken,
  };
}

function makePlayers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `لاعب${index + 1}`,
    isConnected: true,
    isHost: index === 0,
    isReady: true,
    isSpectator: false,
  }));
}

function ack<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    socket
      .timeout(15000)
      .emit(event, payload, (err: Error | null, res: T) => (err ? reject(err) : resolve(res)));
  });
}

async function connectClient(url: string, cookie?: string): Promise<Socket> {
  const socket = ioClient(url, {
    autoConnect: true,
    withCredentials: true,
    extraHeaders: cookie ? { cookie } : undefined,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

async function withSocketServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  resetAuthRateLimiterForTests();
  setSocketServer(null);
  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => resolve());
  });
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    stopDisconnectedPlayerExpirySweep();
    stopExpiredAuthSessionCleanup();
    setSocketServer(null);
    io.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function createBoundRoom(
  url: string,
  playerName: string,
  cookie?: string,
): Promise<{ socket: Socket; roomId: string; playerId: string; code: string }> {
  const socket = await connectClient(url, cookie);
  const created = await ack<CreateRoomResponse>(socket, CREATE_ROOM_EVENT, { playerName });
  assert.equal(created.success, true, created.success ? '' : created.error.message);
  if (!created.success) {
    throw new Error(created.error.message);
  }
  return {
    socket,
    roomId: created.data.room.id,
    playerId: created.data.player.id,
    code: created.data.room.code,
  };
}

type SettingsAck = RoomActionResponse<{ roomId: string; gameSettings: RoomGameSettings | null }>;

async function main(): Promise<void> {
  resetAuthRateLimiterForTests();

  await test('source: additive JSON field and shared helper', () => {
    const schema = read('prisma/schema.prisma');
    const migration = read('prisma/migrations/20260817180000_add_room_game_settings/migration.sql');
    const shared = read('../../packages/shared/src/game/admin-settings.ts');
    const service = read('src/modules/room/services/update-room-game-settings.service.ts');
    const handlers = read('src/modules/room/room.socket.handlers.ts');
    assert.match(schema, /gameSettings\s+Json\?/);
    assert.match(migration, /ADD COLUMN "gameSettings" JSONB/);
    assert.doesNotMatch(migration, /DROP /);
    assert.match(shared, /function resolveEffectiveGameSettings/);
    assert.match(service, /resolveSocketAccountUser|isAdminSession/);
    assert.match(service, /accountUser\?\.role === 'ADMIN'|isAdminSession/);
    assert.match(service, /hostPlayerId !== input\.playerId/);
    assert.doesNotMatch(service, /player\.userId/);
    assert.match(handlers, /UPDATE_ROOM_GAME_SETTINGS_EVENT/);
    assert.match(handlers, /resolveSocketAccountUser/);
  });

  await test('sanitize: unknown keys ignored, out-of-range rejected', () => {
    const ok = sanitizeGameSettingPatch('bara-al-salafa', {
      questionTurnSeconds: 90,
      secretWord: 'nope',
      briefingSeconds: 3,
    });
    assert.equal(ok.success, true);
    if (ok.success) {
      assert.deepEqual(ok.values, { questionTurnSeconds: 90 });
    }

    const bad = sanitizeGameSettingPatch('bara-al-salafa', { questionTurnSeconds: 9 });
    assert.equal(bad.success, false);

    const hydrated = sanitizeRoomGameSettings({
      'bara-al-salafa': { questionTurnSeconds: 90, unknown: 1 },
      'not-a-game': { rounds: 9 },
    });
    assert.deepEqual(hydrated, { 'bara-al-salafa': { questionTurnSeconds: 90 } });

    const effective = resolveEffectiveGameSettings('bara-al-salafa', null);
    assert.equal(effective.questionTurnSeconds, 60);
    assert.equal(effective.voteSeconds, 60);
    assert.equal(effective.rounds, 3);
  });

  await test('1 Guest cannot edit Admin settings', async () => {
    await withSocketServer(async (url) => {
      const host = await createBoundRoom(url, uniqueName('ضيف'));
      try {
        const response = await ack<SettingsAck>(host.socket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'bara-al-salafa',
          questionTurnSeconds: 90,
        });
        assert.equal(response.success, false);
        if (!response.success) {
          assert.equal(response.error.code, 'FORBIDDEN');
        }
      } finally {
        host.socket.close();
        await cleanupRoom(host.roomId);
      }
    });
  });

  await test('2 USER cannot edit', async () => {
    const account = await registerAccount('user');
    await withSocketServer(async (url) => {
      const host = await createBoundRoom(
        url,
        uniqueName('مستخدم'),
        `${AUTH_COOKIE_NAME}=${account.sessionToken}`,
      );
      try {
        const response = await ack<SettingsAck>(host.socket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'fast-answer',
          answerSeconds: 30,
        });
        assert.equal(response.success, false);
        if (!response.success) {
          assert.equal(response.error.code, 'FORBIDDEN');
        }
      } finally {
        host.socket.close();
        await cleanupRoom(host.roomId);
        await cleanupEmail(account.email);
      }
    });
  });

  await test('3 ADMIN host can edit', async () => {
    const account = await promoteAccount(await registerAccount('admin'));
    await withSocketServer(async (url) => {
      const host = await createBoundRoom(
        url,
        uniqueName('إدارة'),
        `${AUTH_COOKIE_NAME}=${account.sessionToken}`,
      );
      try {
        const response = await ack<SettingsAck>(host.socket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'bara-al-salafa',
          questionTurnSeconds: 90,
          voteSeconds: 45,
          rounds: 5,
        });
        assert.equal(response.success, true, response.success ? '' : response.error.message);
        if (response.success) {
          assert.equal(response.data.gameSettings?.['bara-al-salafa']?.questionTurnSeconds, 90);
          assert.equal(response.data.gameSettings?.['bara-al-salafa']?.rounds, 5);
        }
        const row = await prisma.room.findUnique({
          where: { id: host.roomId },
          select: { gameSettings: true },
        });
        const stored = sanitizeRoomGameSettings(row?.gameSettings);
        assert.equal(stored?.['bara-al-salafa']?.questionTurnSeconds, 90);
      } finally {
        host.socket.close();
        await cleanupRoom(host.roomId);
        await cleanupEmail(account.email);
      }
    });
  });

  await test('3b ADMIN member cannot edit', async () => {
    const account = await promoteAccount(await registerAccount('member'));
    await withSocketServer(async (url) => {
      const host = await createBoundRoom(url, uniqueName('مضيف'));
      const memberSocket = await connectClient(url, `${AUTH_COOKIE_NAME}=${account.sessionToken}`);
      try {
        const joined = await ack<CreateRoomResponse>(memberSocket, JOIN_ROOM_EVENT, {
          roomCode: host.code,
          playerName: uniqueName('إدارة'),
        });
        assert.equal(joined.success, true, joined.success ? '' : joined.error.message);
        if (joined.success) {
          assert.equal(joined.data.player.isHost, false);
        }
        const response = await ack<SettingsAck>(memberSocket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'fast-answer',
          answerSeconds: 10,
          rounds: 10,
        });
        assert.equal(response.success, false);
        if (!response.success) {
          assert.equal(response.error.code, 'FORBIDDEN');
        }
        const row = await prisma.room.findUnique({
          where: { id: host.roomId },
          select: { gameSettings: true, hostPlayerId: true },
        });
        assert.equal(row?.hostPlayerId, host.playerId);
        assert.equal(sanitizeRoomGameSettings(row?.gameSettings), null);
      } finally {
        memberSocket.close();
        host.socket.close();
        await cleanupRoom(host.roomId);
        await cleanupEmail(account.email);
      }
    });
  });

  await test('4 client role spoof fails', async () => {
    await withSocketServer(async (url) => {
      const host = await createBoundRoom(url, uniqueName('تزييف'));
      try {
        const response = await ack<SettingsAck>(host.socket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'draw-guess',
          role: 'ADMIN',
          drawSeconds: 90,
        });
        assert.equal(response.success, false);
        if (!response.success) {
          assert.equal(response.error.code, 'FORBIDDEN');
        }
      } finally {
        host.socket.close();
        await cleanupRoom(host.roomId);
      }
    });
  });

  await test('5 Player.userId alone insufficient', async () => {
    const account = await promoteAccount(await registerAccount('userid'));
    await withSocketServer(async (url) => {
      const host = await createBoundRoom(url, uniqueName('ربط'));
      try {
        await prisma.player.update({
          where: { id: host.playerId },
          data: { userId: account.user.id },
        });
        const response = await ack<SettingsAck>(host.socket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'who-wrote-it',
          answerSeconds: 90,
        });
        assert.equal(response.success, false);
        if (!response.success) {
          assert.equal(response.error.code, 'FORBIDDEN');
        }
      } finally {
        host.socket.close();
        await cleanupRoom(host.roomId);
        await cleanupEmail(account.email);
      }
    });
  });

  await test('6 expired Admin session fails', async () => {
    const account = await promoteAccount(await registerAccount('expired'));
    await withSocketServer(async (url) => {
      const host = await createBoundRoom(
        url,
        uniqueName('منتهية'),
        `${AUTH_COOKIE_NAME}=${account.sessionToken}`,
      );
      try {
        await logoutAuthSession(account.sessionToken);
        const response = await ack<SettingsAck>(host.socket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'imposter-draw',
          drawTurnSeconds: 30,
        });
        assert.equal(response.success, false);
        if (!response.success) {
          assert.equal(response.error.code, 'FORBIDDEN');
        }
      } finally {
        host.socket.close();
        await cleanupRoom(host.roomId);
        await cleanupEmail(account.email);
      }
    });
  });

  await test('7 active-game edits rejected', async () => {
    const account = await promoteAccount(await registerAccount('live'));
    await withSocketServer(async (url) => {
      const host = await createBoundRoom(
        url,
        uniqueName('جارية'),
        `${AUTH_COOKIE_NAME}=${account.sessionToken}`,
      );
      try {
        const started = await initGameShell(host.roomId, host.playerId, {
          gameId: 'fast-answer',
        });
        assert.equal(started.success, true);
        const response = await ack<SettingsAck>(host.socket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'fast-answer',
          answerSeconds: 30,
        });
        assert.equal(response.success, false);
        if (!response.success) {
          assert.equal(response.error.code, 'MATCH_IN_PROGRESS');
        }
      } finally {
        host.socket.close();
        await cleanupRoom(host.roomId);
        await cleanupEmail(account.email);
      }
    });
  });

  await test('8-9 server rejects out-of-range and ignores unknown keys', async () => {
    const account = await promoteAccount(await registerAccount('range'));
    await withSocketServer(async (url) => {
      const host = await createBoundRoom(
        url,
        uniqueName('نطاق'),
        `${AUTH_COOKIE_NAME}=${account.sessionToken}`,
      );
      try {
        const outOfRange = await ack<SettingsAck>(host.socket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'guessing-challenge',
          turnSeconds: 200,
        });
        assert.equal(outOfRange.success, false);
        if (!outOfRange.success) {
          assert.equal(outOfRange.error.code, 'VALIDATION_ERROR');
        }

        const mixed = await ack<SettingsAck>(host.socket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'guessing-challenge',
          turnSeconds: 60,
          yellowCards: 9,
          role: 'ADMIN',
        });
        assert.equal(mixed.success, true, mixed.success ? '' : mixed.error.message);
        if (mixed.success) {
          assert.equal(mixed.data.gameSettings?.['guessing-challenge']?.turnSeconds, 60);
          assert.equal(JSON.stringify(mixed.data.gameSettings).includes('yellowCards'), false);
        }
      } finally {
        host.socket.close();
        await cleanupRoom(host.roomId);
        await cleanupEmail(account.email);
      }
    });
  });

  await test('10 settings survive Host transfer', async () => {
    const account = await promoteAccount(await registerAccount('transfer'));
    await withSocketServer(async (url) => {
      const host = await createBoundRoom(
        url,
        uniqueName('مضيف'),
        `${AUTH_COOKIE_NAME}=${account.sessionToken}`,
      );
      try {
        const joiner = await joinRoom({ roomCode: host.code, playerName: uniqueName('لاحق') });
        assert.equal(joiner.success, true);
        const saved = await ack<SettingsAck>(host.socket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'draw-guess',
          drawSeconds: 90,
          rounds: 4,
        });
        assert.equal(saved.success, true, saved.success ? '' : saved.error.message);
        const left = await leaveRoom(host.playerId, host.roomId);
        assert.equal(left.success, true);
        const row = await prisma.room.findUnique({
          where: { id: host.roomId },
          select: { gameSettings: true, hostPlayerId: true },
        });
        const stored = sanitizeRoomGameSettings(row?.gameSettings);
        assert.equal(stored?.['draw-guess']?.drawSeconds, 90);
        assert.notEqual(row?.hostPlayerId, host.playerId);
      } finally {
        host.socket.close();
        await cleanupRoom(host.roomId);
        await cleanupEmail(account.email);
      }
    });
  });

  await test('11 settings survive Admin logout', async () => {
    const account = await promoteAccount(await registerAccount('logout'));
    await withSocketServer(async (url) => {
      const host = await createBoundRoom(
        url,
        uniqueName('خروج'),
        `${AUTH_COOKIE_NAME}=${account.sessionToken}`,
      );
      try {
        const saved = await ack<SettingsAck>(host.socket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'judge',
          answerSeconds: 90,
          rounds: 2,
        });
        assert.equal(saved.success, true, saved.success ? '' : saved.error.message);
        await logoutAuthSession(account.sessionToken);
        const row = await prisma.room.findUnique({
          where: { id: host.roomId },
          select: { gameSettings: true },
        });
        const stored = sanitizeRoomGameSettings(row?.gameSettings);
        assert.equal(stored?.judge?.answerSeconds, 90);
        assert.equal(stored?.judge?.rounds, 2);
        const blocked = await ack<SettingsAck>(host.socket, UPDATE_ROOM_GAME_SETTINGS_EVENT, {
          gameId: 'judge',
          rounds: 6,
        });
        assert.equal(blocked.success, false);
      } finally {
        host.socket.close();
        await cleanupRoom(host.roomId);
        await cleanupEmail(account.email);
      }
    });
  });

  await test('12 restart preserves persisted settings', async () => {
    const created = await createRoom({ playerName: uniqueName('إعادة') }, null, 'ADMIN');
    assert.equal(created.success, true);
    if (!created.success) {
      throw new Error(created.error.message);
    }
    const roomId = created.data.room.id;
    try {
      await prisma.room.update({
        where: { id: roomId },
        data: {
          gameSettings: { 'fast-answer': { answerSeconds: 30, rounds: 8 } },
        },
      });
      clearRoomGameSettingsCache(roomId);
      const hydrated = await hydrateRoomGameSettings(roomId);
      assert.equal(hydrated?.['fast-answer']?.answerSeconds, 30);
      assert.equal(hydrated?.['fast-answer']?.rounds, 8);
    } finally {
      await cleanupRoom(roomId);
    }
  });

  await test('13 normal Room defaults unchanged', () => {
    const bara = getLoadedGameContent('bara-al-salafa');
    assert.ok(bara);
    const match = createBaraMatch(makePlayers(3), bara.bundle, bara.settings);
    assert.equal(match.totalRounds, 1);
    assert.equal(match.round.questionTurnDurationSeconds, 15);
    assert.equal(match.round.votingDurationSeconds, 15);

    const draw = getLoadedGameContent('draw-guess');
    assert.ok(draw);
    const drawMatch = createDrawMatch('defaults-draw', makePlayers(3), draw.settings);
    assert.equal(drawMatch.totalRounds, 3);
    assert.equal(drawMatch.round.drawingDurationSeconds, 15);

    const payload = validateStartGameShellFromLobbyPayload({
      gameId: 'timing-challenge',
      timingChallenge: { mode: 'guess-time', minSeconds: 3, maxSeconds: 90 },
    });
    assert.equal(payload.success, false);
  });

  await test('14 Bara settings apply', () => {
    const content = getLoadedGameContent('bara-al-salafa');
    assert.ok(content);
    setRoomGameSettingsCache('bara-apply', {
      'bara-al-salafa': { questionTurnSeconds: 90, voteSeconds: 45, rounds: 5 },
    });
    const match = createBaraMatch(
      makePlayers(3),
      content.bundle,
      content.settings,
      undefined,
      'bara-apply',
    );
    assert.equal(match.totalRounds, 5);
    assert.equal(match.round.questionTurnDurationSeconds, 90);
    assert.equal(match.round.votingDurationSeconds, 45);
    clearRoomGameSettingsCache('bara-apply');
  });

  await test('15 Draw Guess settings apply', () => {
    const content = getLoadedGameContent('draw-guess');
    assert.ok(content);
    setRoomGameSettingsCache('draw-apply', {
      'draw-guess': { drawSeconds: 90, rounds: 5 },
    });
    const match = createDrawMatch('draw-apply', makePlayers(3), content.settings);
    assert.equal(match.totalRounds, 5);
    assert.equal(match.round.drawingDurationSeconds, 90);
    clearRoomGameSettingsCache('draw-apply');
  });

  await test('16 Imposter Draw settings apply', () => {
    const content = getLoadedGameContent('imposter-draw');
    assert.ok(content);
    setRoomGameSettingsCache('imposter-apply', {
      'imposter-draw': { drawTurnSeconds: 30, voteSeconds: 90, rounds: 4 },
    });
    const match = createImposterMatch('imposter-apply', makePlayers(3), content.settings);
    assert.equal(match.totalRounds, 4);
    assert.equal(match.round.turnDurationSeconds, 30);
    clearRoomGameSettingsCache('imposter-apply');
  });

  await test('17 Timing Admin max 120; normal max 60', () => {
    const normal = applyTimingChallengeLobbySettings('timing-normal', {
      mode: 'guess-time',
      minSeconds: 3,
      maxSeconds: 15,
    });
    assert.equal(normal.success, true);
    assert.equal(getTimingChallengeSettings('timing-normal')?.maxSeconds, 15);

    setRoomGameSettingsCache('timing-admin', {
      'timing-challenge': { minSeconds: 5, maxSeconds: 120 },
    });
    const admin = applyTimingChallengeLobbySettings('timing-admin', {
      mode: 'stop-timer',
      minSeconds: 3,
      maxSeconds: 15,
    });
    assert.equal(admin.success, true);
    const applied = getTimingChallengeSettings('timing-admin');
    assert.equal(applied?.mode, 'stop-timer');
    assert.equal(applied?.minSeconds, 5);
    assert.equal(applied?.maxSeconds, 120);
    clearRoomGameSettingsCache('timing-admin');
  });

  await test('18 Fast Answer settings apply', () => {
    const content = getLoadedGameContent('fast-answer');
    assert.ok(content);
    setRoomGameSettingsCache('fast-apply', {
      'fast-answer': { answerSeconds: 30, rounds: 8 },
    });
    const match = createFastMatch('fast-apply', makePlayers(3), content.settings);
    assert.equal(match.totalRounds, 8);
    assert.equal(match.roundTimeSeconds, 30);
    clearRoomGameSettingsCache('fast-apply');
  });

  await test('19 Who Wrote It settings apply', () => {
    const content = getLoadedGameContent('who-wrote-it');
    assert.ok(content);
    setRoomGameSettingsCache('wwi-apply', {
      'who-wrote-it': { answerSeconds: 90, guessSeconds: 45, rounds: 4 },
    });
    const match = createWhoMatch('wwi-apply', makePlayers(3), content.settings);
    assert.equal(match.totalRounds, 4);
    assert.equal(match.answerSeconds, 90);
    assert.equal(match.guessSeconds, 45);
    clearRoomGameSettingsCache('wwi-apply');
  });

  await test('20 Judge settings apply', () => {
    const content = getLoadedGameContent('judge');
    assert.ok(content);
    const defaultMatch = createJudgeMatch('judge-default', makePlayers(4), content.settings);
    assert.equal(defaultMatch.totalRounds, 4);
    assert.equal(defaultMatch.configuredTotalRounds, null);

    setRoomGameSettingsCache('judge-apply', {
      judge: { answerSeconds: 90, judgeSeconds: 45, rounds: 2 },
    });
    const match = createJudgeMatch('judge-apply', makePlayers(4), content.settings);
    assert.equal(match.totalRounds, 2);
    assert.equal(match.configuredTotalRounds, 2);
    assert.equal(match.answerSeconds, 90);
    assert.equal(match.judgeSeconds, 45);
    assert.equal(match.judgeOrder.length, 2);
    clearRoomGameSettingsCache('judge-apply');
  });

  await test('21 GC turnSeconds applies; player count remains 2/4', () => {
    const content = getLoadedGameContent('guessing-challenge');
    assert.ok(content);
    assert.equal(requiredPlayerCountForMode('1v1'), 2);
    assert.equal(requiredPlayerCountForMode('2v2'), 4);
    setRoomGameSettingsCache('gc-apply', {
      'guessing-challenge': { turnSeconds: 90 },
    });
    const match = createGcMatch('gc-apply', makePlayers(2), content.settings, '1v1');
    assert.equal(match.totalRounds, 4);
    assert.equal(match.turnSeconds, 90);
    assert.equal(match.round.phaseRemainingSeconds, 90);
    assert.equal(match.playerIds.length, 2);
    clearRoomGameSettingsCache('gc-apply');
  });

  await test('privacy: settings snapshot has no role/userId/email', async () => {
    const created = await createRoom({ playerName: uniqueName('خصوصية') }, null, 'ADMIN');
    assert.equal(created.success, true);
    if (!created.success) {
      throw new Error(created.error.message);
    }
    try {
      assert.equal(created.data.room.gameSettings, null);
      const raw = JSON.stringify(created.data);
      assert.doesNotMatch(raw, /"role"|passwordHash|"userId"|@example.com/);
    } finally {
      await cleanupRoom(created.data.room.id);
    }
  });

  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
