/**
 * Display-gate for persistent open-room claims.
 * Run: node ../server/node_modules/tsx/dist/cli.mjs tests/resume-claim-display.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RECONNECT_CLAIMS_STORAGE_KEY,
  discoverResumableRoomSession,
  listDiscoverableReconnectClaims,
  notifyResumeDiscovery,
  readReconnectClaim,
  writePersistedActiveRoomSession,
  writeReconnectClaim,
  type ActiveRoomSession,
} from '../lib/room-v2/index';
import { decideVerifiedResumeDisplay, fetchRoomReturnability } from '../lib/room-v2/room-returnability';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  get length(): number {
    return this.store.size;
  }
  key(i: number): string | null {
    return [...this.store.keys()][i] ?? null;
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();

(globalThis as unknown as { window: { localStorage: Storage; sessionStorage: Storage } }).window = {
  localStorage: localStorage as unknown as Storage,
  sessionStorage: sessionStorage as unknown as Storage,
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sample: ActiveRoomSession = {
  roomId: 'room-1',
  roomCode: '123456',
  playerId: 'player-1',
  playerName: 'خلود',
  reconnectToken: 'token-1',
};
const other: ActiveRoomSession = {
  roomId: 'room-2',
  roomCode: '654321',
  playerId: 'player-2',
  playerName: 'محمد',
  reconnectToken: 'token-2',
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
    console.error(error instanceof Error ? error.message : error);
  }
}

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function seedReconnectClaimMap(claims: ActiveRoomSession[]): void {
  const map: Record<string, ActiveRoomSession> = {};
  for (const claim of claims) {
    map[`${claim.roomCode}\u001f${claim.playerName.trim()}`] = claim;
  }
  localStorage.setItem(RECONNECT_CLAIMS_STORAGE_KEY, JSON.stringify(map));
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function main(): Promise<void> {
  await test('valid/open room -> claim is displayed', () => {
    const decision = decideVerifiedResumeDisplay([sample], 'returnable');
    assert.deepEqual(decision.claimsToShow, [sample]);
    assert.equal(decision.claimToDiscard, null);
  });

  await test('closed room -> claim is hidden and marked for cleanup', () => {
    const decision = decideVerifiedResumeDisplay([sample], 'not_returnable');
    assert.deepEqual(decision.claimsToShow, []);
    assert.equal(decision.claimToDiscard, sample);
  });

  await test('missing room uses the same not-returnable cleanup decision', () => {
    const decision = decideVerifiedResumeDisplay([sample], 'not_returnable');
    assert.deepEqual(decision.claimsToShow, []);
    assert.equal(decision.claimToDiscard?.roomCode, '123456');
  });

  await test('verification/network failure does not present the claim as valid', () => {
    const decision = decideVerifiedResumeDisplay([sample], 'unknown');
    assert.deepEqual(decision.claimsToShow, []);
    assert.equal(decision.claimToDiscard, null);
  });

  await test('fetch: open room is returnable', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      jsonResponse(200, { success: true, data: { returnable: true } })) as typeof fetch;
    try {
      assert.equal(await fetchRoomReturnability('123456'), 'returnable');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await test('fetch: closed or missing room is not returnable', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      jsonResponse(200, { success: true, data: { returnable: false } })) as typeof fetch;
    try {
      assert.equal(await fetchRoomReturnability('123456'), 'not_returnable');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await test('fetch: server/network failure is unknown', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => jsonResponse(500, { success: false })) as typeof fetch;
    try {
      assert.equal(await fetchRoomReturnability('123456'), 'unknown');
    } finally {
      globalThis.fetch = originalFetch;
    }

    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    try {
      assert.equal(await fetchRoomReturnability('123456'), 'unknown');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await test('current active same-tab room still hides the persistent claim', () => {
    localStorage.clear();
    sessionStorage.clear();
    notifyResumeDiscovery();
    writeReconnectClaim(sample);
    writePersistedActiveRoomSession(sample);
    notifyResumeDiscovery();
    assert.equal(discoverResumableRoomSession(), null);
    assert.equal(discoverResumableRoomSession('123456'), null);
    const decision = decideVerifiedResumeDisplay(listDiscoverableReconnectClaims(), 'returnable');
    assert.deepEqual(decision.claimsToShow, []);
    assert.deepEqual(readReconnectClaim('123456', 'خلود'), sample);
  });

  await test('newest single persistent claim remains the only discovered candidate', () => {
    localStorage.clear();
    sessionStorage.clear();
    notifyResumeDiscovery();
    seedReconnectClaimMap([sample, other]);
    assert.deepEqual(listDiscoverableReconnectClaims(), [other]);
    const decision = decideVerifiedResumeDisplay(listDiscoverableReconnectClaims(), 'returnable');
    assert.deepEqual(decision.claimsToShow, [other]);
  });

  await test('matching invite still discovers only that room claim', () => {
    localStorage.clear();
    sessionStorage.clear();
    notifyResumeDiscovery();
    seedReconnectClaimMap([sample, other]);
    assert.deepEqual(listDiscoverableReconnectClaims('123456'), [sample]);
    const decision = decideVerifiedResumeDisplay(listDiscoverableReconnectClaims('123456'), 'returnable');
    assert.deepEqual(decision.claimsToShow, [sample]);
    assert.deepEqual(listDiscoverableReconnectClaims('654321'), [other]);
  });

  await test('Return to Room still uses existing reconnect authorization', () => {
    const hook = read('lib/public/use-room-actions.ts');
    const banner = read('components/public/active-room-banner.tsx');
    const verify = read('lib/room-v2/room-returnability.ts');
    const gate = read('lib/room-v2/use-verified-resume-claims.ts');
    assert.match(hook, /enterFromJoinForm\(claim\.roomCode, claim\.playerName\)/);
    assert.match(banner, /enterFromJoinForm\(claim\.roomCode, claim\.playerName\)/);
    assert.match(hook, /useVerifiedResumeClaims/);
    assert.match(banner, /useVerifiedResumeClaims/);
    assert.match(gate, /fetchRoomReturnability/);
    assert.doesNotMatch(verify, /enterFromJoinForm/);
    assert.doesNotMatch(gate, /enterFromJoinForm/);
    assert.doesNotMatch(verify, /reconnectToken/);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
