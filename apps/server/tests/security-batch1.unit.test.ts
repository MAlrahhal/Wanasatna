/**
 * Pre-launch security hardening, Batch 1.
 * Run: pnpm --filter @wanasatna/server test:security-batch1
 */
import assert from 'node:assert/strict';
import { createServer, type Server as HttpServer } from 'node:http';
import express, { type Express } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as createSocketClient, type Socket } from 'socket.io-client';
import {
  createRequireTrustedMutationOrigin,
  createSocketOriginAllowRequest,
  isRequestOriginAllowed,
  type OriginPolicy,
} from '../src/lib/origin-policy.js';
import {
  createRequirePublicRegistration,
  isPublicRegistrationEnabled,
} from '../src/modules/auth/public-registration.js';

const productionPolicy: OriginPolicy = {
  nodeEnv: 'production',
  clientOrigin: 'https://wanasatna.com',
};

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
  }
}

async function listen(server: HttpServer): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

async function closeServer(server: HttpServer): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function withHttpApp<T>(app: Express, fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createServer(app);
  const baseUrl = await listen(server);
  try {
    return await fn(baseUrl);
  } finally {
    await closeServer(server);
  }
}

async function socketConnects(
  baseUrl: string,
  origin?: string,
  options: {
    transports?: Array<'polling' | 'websocket'>;
    expectedTransport?: 'polling' | 'websocket';
  } = {},
): Promise<boolean> {
  const extraHeaders = origin === undefined ? undefined : { Origin: origin };
  const socket: Socket = createSocketClient(baseUrl, {
    transports: options.transports ?? ['websocket'],
    forceNew: true,
    reconnection: false,
    timeout: 1_000,
    extraHeaders,
  });

  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (connected: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      socket.close();
      resolve(connected);
    };
    const timeout = setTimeout(() => finish(false), 3_000);
    socket.once('connect', () => {
      if (
        !options.expectedTransport ||
        socket.io.engine.transport.name === options.expectedTransport
      ) {
        finish(true);
        return;
      }
      socket.io.engine.once('upgrade', (transport) => {
        finish(transport.name === options.expectedTransport);
      });
    });
    socket.once('connect_error', () => finish(false));
  });
}

async function main(): Promise<void> {
  await test('production HTTP origin policy accepts only the official origin', () => {
    assert.equal(isRequestOriginAllowed('https://wanasatna.com', productionPolicy), true);
    assert.equal(isRequestOriginAllowed('https://wanasatna.com/', productionPolicy), true);
    assert.equal(
      isRequestOriginAllowed('https://wanasatna.com.evil.example', productionPolicy),
      false,
    );
    assert.equal(isRequestOriginAllowed('null', productionPolicy), false);
    assert.equal(isRequestOriginAllowed(undefined, productionPolicy), false);
  });

  await test('HTTP mutations reject malicious and missing origins before side effects', async () => {
    let mutationCount = 0;
    const app = express();
    app.use('/api', createRequireTrustedMutationOrigin(productionPolicy));
    app.post('/api/mutate', (_req, res) => {
      mutationCount += 1;
      res.status(204).end();
    });

    await withHttpApp(app, async (baseUrl) => {
      const official = await fetch(`${baseUrl}/api/mutate`, {
        method: 'POST',
        headers: { Origin: 'https://wanasatna.com' },
      });
      assert.equal(official.status, 204);
      assert.equal(mutationCount, 1);

      const malicious = await fetch(`${baseUrl}/api/mutate`, {
        method: 'POST',
        headers: { Origin: 'https://attacker.example' },
      });
      assert.equal(malicious.status, 403);
      assert.equal(mutationCount, 1);

      const missing = await fetch(`${baseUrl}/api/mutate`, { method: 'POST' });
      assert.equal(missing.status, 403);
      assert.equal(mutationCount, 1);
    });
  });

  await test('production registration is disabled before registration side effects', async () => {
    assert.equal(isPublicRegistrationEnabled('production'), false);
    assert.equal(isPublicRegistrationEnabled('test'), true);

    let registrationCount = 0;
    const app = express();
    app.use('/api', createRequireTrustedMutationOrigin(productionPolicy));
    app.post('/api/auth/register', createRequirePublicRegistration('production'), (_req, res) => {
      registrationCount += 1;
      res.status(201).end();
    });

    await withHttpApp(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { Origin: 'https://wanasatna.com' },
      });
      assert.equal(response.status, 403);
      assert.equal(registrationCount, 0);
    });
  });

  await test('Socket.IO accepts official Origin and rejects malicious or missing Origin', async () => {
    const httpServer = createServer();
    const io = new SocketIOServer(httpServer, {
      allowRequest: createSocketOriginAllowRequest(productionPolicy),
    });
    const baseUrl = await listen(httpServer);

    try {
      assert.equal(await socketConnects(baseUrl, 'https://wanasatna.com'), true);
      assert.equal(
        await socketConnects(baseUrl, 'https://wanasatna.com', {
          transports: ['polling', 'websocket'],
          expectedTransport: 'websocket',
        }),
        true,
      );
      assert.equal(await socketConnects(baseUrl, 'https://attacker.example'), false);
      assert.equal(await socketConnects(baseUrl), false);
    } finally {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await closeServer(httpServer);
    }
  });

  await test('non-production guest Socket.IO policy remains registration-independent', () => {
    assert.equal(
      isRequestOriginAllowed(undefined, {
        nodeEnv: 'test',
        clientOrigin: 'http://localhost:3000',
      }),
      true,
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
