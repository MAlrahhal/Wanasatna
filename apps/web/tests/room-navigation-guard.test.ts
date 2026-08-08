/**
 * Unit tests for room navigation guard helpers.
 * Run: node ../server/node_modules/tsx/dist/cli.mjs tests/room-navigation-guard.test.ts
 */
import assert from 'node:assert/strict';
import {
  canViewRoomInvitationDetails,
  isRoomRoute,
  shouldGuardNavigation,
  shouldHideCreateRoomAction,
} from '../lib/room/navigation-guard';

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

test('isRoomRoute matches lobby and game routes', () => {
  assert.equal(isRoomRoute('/lobby'), true);
  assert.equal(isRoomRoute('/game'), true);
  assert.equal(isRoomRoute('/'), false);
  assert.equal(isRoomRoute('/faq'), false);
});

test('shouldGuardNavigation is false without active session', () => {
  assert.equal(shouldGuardNavigation(false, '/'), false);
  assert.equal(shouldGuardNavigation(false, '/faq'), false);
});

test('shouldGuardNavigation guards public routes with active session', () => {
  assert.equal(shouldGuardNavigation(true, '/'), true);
  assert.equal(shouldGuardNavigation(true, '/faq'), true);
  assert.equal(shouldGuardNavigation(true, '/games'), true);
});

test('shouldGuardNavigation allows room routes with active session', () => {
  assert.equal(shouldGuardNavigation(true, '/lobby'), false);
  assert.equal(shouldGuardNavigation(true, '/lobby?code=123456'), false);
  assert.equal(shouldGuardNavigation(true, '/game'), false);
});

test('shouldHideCreateRoomAction when session active', () => {
  assert.equal(shouldHideCreateRoomAction(true), true);
  assert.equal(shouldHideCreateRoomAction(false), false);
});

test('canViewRoomInvitationDetails is host-only', () => {
  assert.equal(canViewRoomInvitationDetails(true), true);
  assert.equal(canViewRoomInvitationDetails(false), false);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
