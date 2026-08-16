/**
 * P12-B.3 web contracts: optional cookie auth APIs, guests can still play.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
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

test('login talks to httpOnly cookie auth APIs; no localStorage/JWT tokens', () => {
  const login = read('app/(public)/login/login-page-client.tsx');
  const api = read('lib/auth/api.ts');
  assert.match(login, /useAuth/);
  assert.match(api, /credentials: 'include'/);
  assert.match(api, /\/api\/auth/);
  assert.doesNotMatch(api, /localStorage|sessionStorage|jwt|bearer/i);
  assert.doesNotMatch(login, /localStorage|sessionStorage|jwt/i);
  assert.doesNotMatch(login, /تسجيل الدخول قيد التطوير/);
});

test('Home still lets guests play without blocking on auth', () => {
  const home = read('app/(public)/home-page-client.tsx');
  assert.doesNotMatch(home, /\/api\/auth/);
  assert.doesNotMatch(home, /status === 'loading'/);
  assert.match(home, /بدون تسجيل/);
});

test('guest CTA remains on login', () => {
  const login = read('app/(public)/login/login-page-client.tsx');
  const copy = read('lib/auth/copy.ts');
  assert.match(login, /AUTH_COPY\.playAsGuest/);
  assert.match(copy, /العب بدون حساب/);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
