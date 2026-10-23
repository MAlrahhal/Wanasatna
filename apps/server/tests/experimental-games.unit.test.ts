import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYABLE_GAME_IDS, sanitizeRoomGameSettings } from '@wanasatna/shared';
import { isExperimentalGamesCapabilityEnabled } from '../src/config/experimental-games.js';
import { authorizeAdmin } from '../src/modules/admin/require-admin.js';
import { validateSelectExperimentalGamePayload } from '../src/modules/game/game.validators.js';
import { evaluateExperimentalGameAccess } from '../src/modules/game/experimental/experimental-game-access.policy.js';
import { listExperimentalGames } from '../src/modules/game/experimental/experimental-game.registry.js';
import { registerAllExperimentalGames } from '../src/modules/game/experimental/register-experimental-games.js';
import {
  clearAllExperimentalGameSelectionsForTests,
  clearExperimentalGameSelection,
  getExperimentalGameSelection,
  hydrateExperimentalGameSelection,
  persistExperimentalGameSelection,
  readPersistedExperimentalGameSelection,
  removePersistedExperimentalGameSelection,
  setExperimentalGameSelection,
} from '../src/modules/game/experimental/experimental-game-selection.store.js';

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

const allowedFacts = {
  enabled: true,
  registered: true,
  accountUserId: 'admin-user',
  accountRole: 'ADMIN' as const,
  roomCreatedByAdmin: true,
  roomStatus: 'LOBBY' as const,
  roomHostPlayerId: 'admin-player',
  requestingPlayerId: 'admin-player',
  linkedHostUserId: 'admin-user',
  linkedHostUserRole: 'ADMIN' as const,
  linkedHostAdminMfaEnabled: true,
};

test('production playtest and non-production capability flags are separate and fail closed', () => {
  assert.equal(
    isExperimentalGamesCapabilityEnabled('development', undefined, '1', undefined),
    true,
  );
  assert.equal(isExperimentalGamesCapabilityEnabled('test', undefined, '1', undefined), true);
  assert.equal(
    isExperimentalGamesCapabilityEnabled('development', undefined, undefined, '1'),
    false,
  );
  assert.equal(isExperimentalGamesCapabilityEnabled('development', undefined, '0', '1'), false);
  assert.equal(isExperimentalGamesCapabilityEnabled('production', 'staging', '1', '1'), false);
  assert.equal(isExperimentalGamesCapabilityEnabled('production', 'production', '1', '1'), true);
  assert.equal(isExperimentalGamesCapabilityEnabled('production', 'production', '1', '0'), false);
  assert.equal(isExperimentalGamesCapabilityEnabled('production', undefined, '1', '1'), false);
});

test('real closed-test game registers separately and the public game count remains eight', () => {
  registerAllExperimentalGames();
  assert.deepEqual(
    listExperimentalGames().map((game) => game.gameId),
    ['emoji-language', 'most-likely-to', 'secret-agents'],
  );
  assert.equal(PLAYABLE_GAME_IDS.length, 8);
  assert.deepEqual(
    [...PLAYABLE_GAME_IDS],
    [
      'bara-al-salafa',
      'draw-guess',
      'imposter-draw',
      'timing-challenge',
      'who-wrote-it',
      'judge',
      'guessing-challenge',
      'fast-answer',
    ],
  );
});

test('admin gate accepts ADMIN and rejects USER or Guest', () => {
  const admin = authorizeAdmin({
    id: 'admin-user',
    email: 'admin@example.test',
    preferredDisplayName: 'Admin',
    role: 'ADMIN',
  });
  assert.equal(admin.ok, true);

  const user = authorizeAdmin({
    id: 'user',
    email: 'user@example.test',
    preferredDisplayName: 'User',
    role: 'USER',
  });
  assert.equal(user.ok, false);
  if (!user.ok) assert.equal(user.status, 403);

  const guest = authorizeAdmin(null);
  assert.equal(guest.ok, false);
  if (!guest.ok) assert.equal(guest.status, 401);
});

test('only the linked current admin host in an admin-created lobby is allowed', () => {
  assert.equal(evaluateExperimentalGameAccess(allowedFacts), null);

  assert.equal(
    evaluateExperimentalGameAccess({ ...allowedFacts, enabled: false })?.error.code,
    'GAME_DISABLED',
  );

  assert.equal(
    evaluateExperimentalGameAccess({ ...allowedFacts, accountRole: 'USER' })?.error.code,
    'FORBIDDEN',
  );
  assert.equal(
    evaluateExperimentalGameAccess({ ...allowedFacts, requestingPlayerId: 'guest-player' })?.error
      .code,
    'NOT_HOST',
  );
  assert.equal(
    evaluateExperimentalGameAccess({ ...allowedFacts, roomCreatedByAdmin: false })?.error.code,
    'FORBIDDEN',
  );
  assert.equal(
    evaluateExperimentalGameAccess({ ...allowedFacts, linkedHostUserId: 'other-user' })?.error.code,
    'FORBIDDEN',
  );
  assert.equal(
    evaluateExperimentalGameAccess({ ...allowedFacts, linkedHostAdminMfaEnabled: false })?.error
      .code,
    'FORBIDDEN',
  );
  assert.equal(
    evaluateExperimentalGameAccess({ ...allowedFacts, roomStatus: 'PLAYING' })?.error.code,
    'INVALID_PHASE',
  );
});

test('selection payload rejects browser identity, admin, and test-mode claims', () => {
  assert.equal(validateSelectExperimentalGamePayload({ gameId: 'future-game' }).success, true);
  assert.equal(
    validateSelectExperimentalGamePayload({ gameId: 'future-game', isAdmin: true }).success,
    false,
  );
  assert.equal(
    validateSelectExperimentalGamePayload({ gameId: 'future-game', userId: 'admin-user' }).success,
    false,
  );
  assert.equal(
    validateSelectExperimentalGamePayload({ gameId: 'future-game', testMode: true }).success,
    false,
  );
});

test('selection persists in existing room JSON without becoming part of public settings', () => {
  clearAllExperimentalGameSelectionsForTests();
  const selection = {
    gameId: 'future-game',
    hostPlayerId: 'admin-player',
    adminUserId: 'admin-user',
  };
  const persisted = persistExperimentalGameSelection(
    { 'fast-answer': { roundCount: 7 } },
    selection,
  );
  assert.deepEqual(readPersistedExperimentalGameSelection(persisted), selection);
  assert.equal('__experimentalGameSelection' in (sanitizeRoomGameSettings(persisted) ?? {}), false);
  const cleared = removePersistedExperimentalGameSelection(persisted);
  assert.deepEqual(cleared, { 'fast-answer': { roundCount: 7 } });
  assert.equal(readPersistedExperimentalGameSelection(cleared), null);
  hydrateExperimentalGameSelection('room-1', persisted);
  assert.equal(getExperimentalGameSelection('room-1')?.gameId, 'future-game');

  // A temporary socket disconnect does not clear the authoritative room selection.
  assert.equal(getExperimentalGameSelection('room-1')?.hostPlayerId, 'admin-player');
  clearExperimentalGameSelection('room-1');
  assert.equal(getExperimentalGameSelection('room-1'), null);

  setExperimentalGameSelection('room-1', selection);
  assert.equal(getExperimentalGameSelection('room-1')?.adminUserId, 'admin-user');
});

test('finished experimental shells cannot be reset into a new match', () => {
  const service = read('src/modules/game/game.service.ts');
  const resetStart = service.indexOf('export async function resetGameShell');
  const nextFunction = service.indexOf('export async function startGameShellFromLobby', resetStart);
  const resetBody = service.slice(resetStart, nextFunction);
  assert.match(resetBody, /isRegisteredExperimentalGameId\(shell\.gameId\)/);
  assert.match(resetBody, /Experimental games must return to the lobby/);
});

test('admin API and direct page use the existing authenticated Admin boundary', () => {
  const routes = read('src/modules/admin/admin.routes.ts');
  const page = read('../web/app/admin/experimental-games/page.tsx');
  const shell = read('../web/components/admin/admin-shell-client.tsx');
  assert.match(routes, /get\('\/experimental-games', requireAdmin/);
  assert.match(page, /<AdminShell>/);
  assert.match(shell, /fetchAdminMe/);
  assert.match(shell, /gate === 'forbidden'/);
});

test('locked start rechecks authority before roster validation and shell installation', () => {
  const service = read('src/modules/game/game.service.ts');
  const lockedCheck = service.indexOf('authorizeExperimentalGameStartLocked(tx');
  const lockedRosterValidation = service.indexOf('validateGameStart(', lockedCheck);
  const lockedParticipantResolution = service.indexOf(
    'resolveStartParticipantIds',
    lockedRosterValidation,
  );
  const shellInstall = service.indexOf('const shell: GameShellRecord', lockedParticipantResolution);
  assert.ok(lockedCheck >= 0);
  assert.ok(lockedRosterValidation > lockedCheck);
  assert.ok(lockedParticipantResolution > lockedRosterValidation);
  assert.ok(shellInstall > lockedParticipantResolution);

  const handlers = read('src/modules/game/game.socket.handlers.ts');
  const preflight = handlers.indexOf('const denied = await preflightExperimentalGameStart');
  const settingsHydration = handlers.indexOf('await hydrateRoomGameSettings', preflight);
  assert.ok(preflight >= 0);
  assert.ok(settingsHydration > preflight);
  assert.doesNotMatch(handlers, /resolveStartParticipantIds/);
});

test('guest join remains the normal code path and cannot carry access claims', () => {
  const validator = read('src/modules/room/room.validators.ts');
  const joinService = read('src/modules/room/services/join-room.service.ts');
  assert.match(validator, /joinRoomSchema = z\.object\(\{[\s\S]*roomCode:[\s\S]*playerName:/);
  assert.doesNotMatch(joinService, /isAdmin|premiumHost|experimentalGameId/);
  assert.match(joinService, /validateJoinRoomPayload/);

  const roomContext = read('../web/contexts/room-context.tsx');
  assert.match(roomContext, /room\?\.experimentalGameId \?\? null/);
  assert.match(roomContext, /setSelectedGameId\(authoritativeGameId\)/);
  assert.match(roomContext, /!isPlayableGameId\(localGameId\)/);
});

test('closed-test implementation is registered while discovery remains separate', () => {
  const registrations = read('src/modules/game/experimental/register-experimental-games.ts');
  const availability = read('../../packages/shared/src/game/availability.ts');
  const publicRoutes = read('../web/lib/public/game-catalog.ts');
  assert.match(registrations, /registerExperimentalGame\(secretAgentsExperimentalRegistration\)/);
  assert.match(registrations, /registerExperimentalGame\(mostLikelyToExperimentalRegistration\)/);
  assert.match(registrations, /registerExperimentalGame\(emojiLanguageExperimentalRegistration\)/);
  assert.doesNotMatch(availability, /experimental-game-select|future-game/);
  assert.doesNotMatch(publicRoutes, /experimental-games|listExperimentalGames/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
