/**
 * P11-B.3 graceful shutdown — injectable close sequence, no process.exit in the runner.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createGracefulShutdown,
  GRACEFUL_SHUTDOWN_FALLBACK_MS,
  registerProcessShutdownSignals,
  type ClosableServer,
} from '../src/lib/graceful-shutdown.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

const queue: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>): void {
  queue.push({ name, fn });
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function mockServer(label: string, log: string[], hang = false, fail = false): ClosableServer {
  return {
    close(callback) {
      log.push(`${label}.close`);
      if (hang) {
        return;
      }
      callback?.(fail ? new Error(`${label} close failed`) : undefined);
    },
  };
}

async function main(): Promise<void> {
  test('1. SIGTERM path closes socket, HTTP, then Prisma', async () => {
    const log: string[] = [];
    const exits: number[] = [];
    const shutdown = createGracefulShutdown({
      io: mockServer('io', log),
      httpServer: mockServer('http', log),
      prisma: {
        async $disconnect() {
          log.push('prisma.$disconnect');
        },
      },
      exit: (code) => {
        exits.push(code);
      },
    });

    const handlers: Record<string, () => void> = {};
    registerProcessShutdownSignals(shutdown.requestShutdown, (event, handler) => {
      handlers[event] = handler;
    });

    handlers.SIGTERM?.();
    await shutdown.requestShutdown();

    assert.deepEqual(log, ['io.close', 'http.close', 'prisma.$disconnect']);
    assert.deepEqual(exits, [0]);
  });

  test('2. SIGINT uses the same shutdown path', async () => {
    const log: string[] = [];
    const shutdown = createGracefulShutdown({
      io: mockServer('io', log),
      httpServer: mockServer('http', log),
      prisma: {
        async $disconnect() {
          log.push('prisma.$disconnect');
        },
      },
      exit: () => undefined,
    });

    const handlers: Record<string, () => void> = {};
    registerProcessShutdownSignals(shutdown.requestShutdown, (event, handler) => {
      handlers[event] = handler;
    });

    handlers.SIGINT?.();
    await shutdown.requestShutdown();
    assert.deepEqual(log, ['io.close', 'http.close', 'prisma.$disconnect']);
  });

  test('3. second shutdown request does not duplicate close sequence', async () => {
    const log: string[] = [];
    const shutdown = createGracefulShutdown({
      io: mockServer('io', log),
      httpServer: mockServer('http', log),
      prisma: {
        async $disconnect() {
          log.push('prisma.$disconnect');
        },
      },
      exit: () => undefined,
    });

    await Promise.all([shutdown.requestShutdown(), shutdown.requestShutdown()]);
    assert.deepEqual(log, ['io.close', 'http.close', 'prisma.$disconnect']);
  });

  test('4. successful graceful close takes the clean exit path', async () => {
    const exits: number[] = [];
    const shutdown = createGracefulShutdown({
      io: mockServer('io', []),
      httpServer: mockServer('http', []),
      prisma: { async $disconnect() {} },
      exit: (code) => {
        exits.push(code);
      },
    });
    await shutdown.requestShutdown();
    assert.deepEqual(exits, [0]);
  });

  test('5. close failure still attempts Prisma disconnect then exits 1', async () => {
    const log: string[] = [];
    const exits: number[] = [];
    const shutdown = createGracefulShutdown({
      io: mockServer('io', log, false, true),
      httpServer: mockServer('http', log),
      prisma: {
        async $disconnect() {
          log.push('prisma.$disconnect');
        },
      },
      exit: (code) => {
        exits.push(code);
      },
    });
    await shutdown.requestShutdown();
    assert.deepEqual(log, ['io.close', 'prisma.$disconnect']);
    assert.deepEqual(exits, [1]);
  });

  test('6. fallback timer force-exits if shutdown hangs', async () => {
    const exits: number[] = [];
    const timers: Array<{ cb: () => void }> = [];
    const shutdown = createGracefulShutdown({
      io: mockServer('io', [], true),
      httpServer: mockServer('http', []),
      prisma: { async $disconnect() {} },
      exit: (code) => {
        exits.push(code);
      },
      fallbackMs: 25,
      setTimer: (cb) => {
        timers.push({ cb: cb as () => void });
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => undefined,
    });

    void shutdown.requestShutdown();
    assert.equal(timers.length, 1);
    timers[0]!.cb();
    assert.deepEqual(exits, [1]);
  });

  test('7. no fallback timer is created before shutdown starts', () => {
    let timerStarted = false;
    createGracefulShutdown({
      io: mockServer('io', []),
      httpServer: mockServer('http', []),
      prisma: { async $disconnect() {} },
      exit: () => undefined,
      setTimer: (cb, ms) => {
        timerStarted = true;
        return setTimeout(cb, ms);
      },
    });
    assert.equal(timerStarted, false);
    assert.equal(GRACEFUL_SHUTDOWN_FALLBACK_MS, 8_000);
  });

  test('8. shutdown does not write gameplay or Room state', () => {
    const source = read('src/lib/graceful-shutdown.ts');
    const index = read('src/index.ts');
    assert.match(index, /createGracefulShutdown/);
    assert.match(index, /registerProcessShutdownSignals/);
    assert.match(index, /SIGTERM|requestShutdown/);
    assert.doesNotMatch(source, /prisma\.(room|player|match)/);
    assert.doesNotMatch(source, /saveShell|abortActiveMatch|evaluatePlayerRecovery/);
    assert.doesNotMatch(index, /uncaughtException|unhandledRejection/);
  });

  for (const item of queue) {
    try {
      await item.fn();
      passed += 1;
      console.log(`PASS ${item.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${item.name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
