import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server } from 'socket.io';
import { createApp } from '../src/app.js';
import {
  DATABASE_MAINTENANCE_INTERVAL_MS,
  setDatabaseMaintenanceRunForTests,
  setDatabaseMaintenanceTimerClockForTests,
  startDatabaseMaintenanceScheduler,
  stopDatabaseMaintenanceScheduler,
} from '../src/lib/database-maintenance.js';
import { setDatabaseProbeForTests } from '../src/lib/public-health.js';
import {
  cancelDisconnectedPlayerExpiry,
  scheduleDisconnectedPlayerExpiry,
  setDisconnectedPlayerExpiryDependenciesForTests,
  startDisconnectedPlayerExpiryScheduler,
  stopDisconnectedPlayerExpiryScheduler,
} from '../src/modules/room/services/disconnected-player-expiry.service.js';
import {
  getPendingDisconnectedPlayerExpiryForTests,
  setDisconnectedPlayerExpiryClockForTests,
  type ExpiryTimerClock,
} from '../src/modules/room/services/disconnected-player-expiry-timers.js';
import { RECONNECT_WINDOW_MS } from '../src/modules/room/room.utils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  } finally {
    stopDisconnectedPlayerExpiryScheduler();
    setDisconnectedPlayerExpiryDependenciesForTests({});
    setDisconnectedPlayerExpiryClockForTests(null);
    stopDatabaseMaintenanceScheduler();
    setDatabaseMaintenanceRunForTests(null);
    setDatabaseMaintenanceTimerClockForTests(null);
    setDatabaseProbeForTests(null);
  }
}

type FakeTimeout = ReturnType<typeof setTimeout>;

function createFakeTimeoutClock(initialNowMs: number) {
  let nowMs = initialNowMs;
  let nextId = 1;
  const timers = new Map<number, { callback: () => void; dueAtMs: number }>();
  const clock: ExpiryTimerClock = {
    now: () => nowMs,
    setTimeout: (callback, delayMs) => {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, dueAtMs: nowMs + delayMs });
      return id as unknown as FakeTimeout;
    },
    clearTimeout: (handle) => {
      timers.delete(handle as unknown as number);
    },
  };

  function advanceBy(ms: number): void {
    nowMs += ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.dueAtMs <= nowMs)
        .sort((left, right) => left[1].dueAtMs - right[1].dueAtMs)[0];
      if (!due) {
        break;
      }
      timers.delete(due[0]);
      due[1].callback();
    }
  }

  return { clock, advanceBy, pendingCount: () => timers.size };
}

type FakeInterval = ReturnType<typeof setInterval>;

function createFakeIntervalClock() {
  let elapsedMs = 0;
  let nextId = 1;
  const intervals = new Map<
    number,
    { callback: () => void; intervalMs: number; nextAtMs: number }
  >();

  return {
    clock: {
      setInterval: (callback: () => void, intervalMs: number) => {
        const id = nextId;
        nextId += 1;
        intervals.set(id, { callback, intervalMs, nextAtMs: elapsedMs + intervalMs });
        return id as unknown as FakeInterval;
      },
      clearInterval: (handle: FakeInterval) => {
        intervals.delete(handle as unknown as number);
      },
    },
    advanceBy(ms: number) {
      elapsedMs += ms;
      for (const interval of intervals.values()) {
        while (interval.nextAtMs <= elapsedMs) {
          interval.nextAtMs += interval.intervalMs;
          interval.callback();
        }
      }
    },
  };
}

const fakeIo = {} as Server;

async function flushAsync(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function withApp(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected TCP test server address.');
  }
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function main(): Promise<void> {
  await test('zero disconnected players performs one startup query and never polls', async () => {
    const fake = createFakeTimeoutClock(1_000_000);
    setDisconnectedPlayerExpiryClockForTests(fake.clock);
    let loads = 0;
    let expiries = 0;
    setDisconnectedPlayerExpiryDependenciesForTests({
      loadPersisted: async () => {
        loads += 1;
        return [];
      },
      process: async () => {
        expiries += 1;
        return null;
      },
    });

    await startDisconnectedPlayerExpiryScheduler(fakeIo);
    fake.advanceBy(10 * 60 * 1000);
    await flushAsync();

    assert.equal(loads, 1);
    assert.equal(expiries, 0);
    assert.equal(fake.pendingCount(), 0);
  });

  await test('disconnect schedules exact deadline and expires once', async () => {
    const disconnectedAtMs = 2_000_000;
    const fake = createFakeTimeoutClock(disconnectedAtMs);
    setDisconnectedPlayerExpiryClockForTests(fake.clock);
    const processed: string[] = [];
    setDisconnectedPlayerExpiryDependenciesForTests({
      loadPersisted: async () => [],
      process: async (_io, playerId) => {
        processed.push(playerId);
        return null;
      },
    });
    await startDisconnectedPlayerExpiryScheduler(fakeIo);

    scheduleDisconnectedPlayerExpiry('player-1', 'room-1', new Date(disconnectedAtMs));
    const pending = getPendingDisconnectedPlayerExpiryForTests('player-1');
    assert.equal(pending?.deadlineAtMs, disconnectedAtMs + RECONNECT_WINDOW_MS + 1);

    fake.advanceBy(RECONNECT_WINDOW_MS);
    await flushAsync();
    assert.deepEqual(processed, []);

    fake.advanceBy(1);
    await flushAsync();
    assert.deepEqual(processed, ['player-1']);
    assert.equal(getPendingDisconnectedPlayerExpiryForTests('player-1'), null);
  });

  await test('same-room expiry timers serialize their database mutations', async () => {
    const disconnectedAtMs = 2_500_000;
    const fake = createFakeTimeoutClock(disconnectedAtMs);
    setDisconnectedPlayerExpiryClockForTests(fake.clock);
    const processed: string[] = [];
    let active = 0;
    let maxActive = 0;
    let releaseFirst: (() => void) | undefined;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    setDisconnectedPlayerExpiryDependenciesForTests({
      loadPersisted: async () => [],
      process: async (_io, playerId) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        processed.push(`${playerId}:start`);
        if (playerId === 'player-a') {
          await firstBlocked;
        }
        processed.push(`${playerId}:end`);
        active -= 1;
        return null;
      },
    });
    await startDisconnectedPlayerExpiryScheduler(fakeIo);

    scheduleDisconnectedPlayerExpiry('player-a', 'shared-room', new Date(disconnectedAtMs));
    scheduleDisconnectedPlayerExpiry('player-b', 'shared-room', new Date(disconnectedAtMs));
    fake.advanceBy(RECONNECT_WINDOW_MS + 1);
    await flushAsync();

    assert.deepEqual(processed, ['player-a:start']);
    assert.equal(maxActive, 1);

    releaseFirst?.();
    await flushAsync();
    await flushAsync();
    assert.deepEqual(processed, [
      'player-a:start',
      'player-a:end',
      'player-b:start',
      'player-b:end',
    ]);
    assert.equal(maxActive, 1);
  });

  await test('reconnect cancellation and a stale first timer cannot expire a new disconnect', async () => {
    const firstAtMs = 3_000_000;
    const fake = createFakeTimeoutClock(firstAtMs);
    setDisconnectedPlayerExpiryClockForTests(fake.clock);
    const processed: string[] = [];
    setDisconnectedPlayerExpiryDependenciesForTests({
      loadPersisted: async () => [],
      process: async (_io, playerId, _roomId, disconnectedAt) => {
        processed.push(`${playerId}:${disconnectedAt?.getTime()}`);
        return null;
      },
    });
    await startDisconnectedPlayerExpiryScheduler(fakeIo);

    scheduleDisconnectedPlayerExpiry('player-2', 'room-2', new Date(firstAtMs));
    assert.equal(cancelDisconnectedPlayerExpiry('player-2'), true);
    fake.advanceBy(60_000);
    const secondAtMs = firstAtMs + 60_000;
    scheduleDisconnectedPlayerExpiry('player-2', 'room-2', new Date(secondAtMs));

    fake.advanceBy(RECONNECT_WINDOW_MS - 60_000 + 1);
    await flushAsync();
    assert.deepEqual(processed, []);

    fake.advanceBy(60_000);
    await flushAsync();
    assert.deepEqual(processed, [`player-2:${secondAtMs}`]);
  });

  await test('startup reconciliation restores future timers and processes expired rows once', async () => {
    const nowMs = Date.now();
    const fake = createFakeTimeoutClock(nowMs);
    setDisconnectedPlayerExpiryClockForTests(fake.clock);
    let loads = 0;
    const processed: string[] = [];
    setDisconnectedPlayerExpiryDependenciesForTests({
      loadPersisted: async () => {
        loads += 1;
        return [
          {
            id: 'expired-player',
            roomId: 'expired-room',
            lastSeenAt: new Date(nowMs - RECONNECT_WINDOW_MS - 10),
          },
          {
            id: 'future-player',
            roomId: 'future-room',
            lastSeenAt: new Date(nowMs - 30_000),
          },
        ];
      },
      process: async (_io, playerId, roomId) => {
        processed.push(`${playerId}:${roomId}`);
        return {
          playerId,
          roomId,
          roomDeleted: false,
          hostChanged: null,
        };
      },
    });

    const first = await startDisconnectedPlayerExpiryScheduler(fakeIo);
    const second = await startDisconnectedPlayerExpiryScheduler(fakeIo);

    assert.deepEqual(first, { candidates: 2, expired: 1, scheduled: 1 });
    assert.deepEqual(second, { candidates: 0, expired: 0, scheduled: 0 });
    assert.equal(loads, 1);
    assert.deepEqual(processed, ['expired-player:expired-room']);
    assert.ok(getPendingDisconnectedPlayerExpiryForTests('future-player'));
  });

  await test('a transient expiry failure retries only that pending player', async () => {
    const disconnectedAtMs = 4_000_000;
    const fake = createFakeTimeoutClock(disconnectedAtMs);
    setDisconnectedPlayerExpiryClockForTests(fake.clock);
    let attempts = 0;
    setDisconnectedPlayerExpiryDependenciesForTests({
      loadPersisted: async () => [],
      process: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('transient');
        }
        return null;
      },
    });
    await startDisconnectedPlayerExpiryScheduler(fakeIo);
    scheduleDisconnectedPlayerExpiry('retry-player', 'retry-room', new Date(disconnectedAtMs));

    fake.advanceBy(RECONNECT_WINDOW_MS + 1);
    await flushAsync();
    assert.equal(attempts, 1);
    assert.ok(getPendingDisconnectedPlayerExpiryForTests('retry-player'));

    fake.advanceBy(30_000);
    await flushAsync();
    assert.equal(attempts, 2);
    assert.equal(getPendingDisconnectedPlayerExpiryForTests('retry-player'), null);
  });

  await test('maintenance has one daily timer and never runs at 15-minute cadence', async () => {
    const fake = createFakeIntervalClock();
    setDatabaseMaintenanceTimerClockForTests(fake.clock);
    let runs = 0;
    setDatabaseMaintenanceRunForTests(async () => {
      runs += 1;
    });

    startDatabaseMaintenanceScheduler();
    fake.advanceBy(15 * 60 * 1000);
    await flushAsync();
    assert.equal(runs, 0);

    fake.advanceBy(DATABASE_MAINTENANCE_INTERVAL_MS - 15 * 60 * 1000);
    await flushAsync();
    assert.equal(runs, 1);
  });

  await test('source contains no recurring expiry/session/answer database polling', () => {
    const expiry = readFileSync(
      join(root, 'src/modules/room/services/disconnected-player-expiry.service.ts'),
      'utf8',
    );
    const authCleanup = readFileSync(join(root, 'src/modules/auth/auth-session-cleanup.ts'), 'utf8');
    const answerCleanup = readFileSync(
      join(root, 'src/modules/game/runtime/answer-attempt-cleanup.ts'),
      'utf8',
    );
    const sockets = readFileSync(join(root, 'src/sockets/index.ts'), 'utf8');

    assert.doesNotMatch(expiry, /setInterval/);
    assert.doesNotMatch(authCleanup, /setInterval/);
    assert.doesNotMatch(answerCleanup, /setInterval/);
    assert.doesNotMatch(sockets, /startDisconnectedPlayerExpirySweep/);
    assert.equal(DATABASE_MAINTENANCE_INTERVAL_MS, 24 * 60 * 60 * 1000);
  });

  await test('/health/live succeeds without invoking the database readiness probe', async () => {
    let databaseProbes = 0;
    setDatabaseProbeForTests(async () => {
      databaseProbes += 1;
      throw new Error('database unavailable');
    });

    await withApp(async (baseUrl) => {
      const live = await fetch(`${baseUrl}/health/live`);
      assert.equal(live.status, 200);
      assert.deepEqual(await live.json(), { status: 'ok' });
      assert.equal(databaseProbes, 0);

      const ready = await fetch(`${baseUrl}/health`);
      assert.equal(ready.status, 503);
      assert.equal(databaseProbes, 1);
    });
  });

  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
