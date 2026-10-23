import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_NAV_ITEMS, ADMIN_ROUTES } from '../lib/admin/routes';

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

test('experimental area is clearly labeled inside Admin navigation', () => {
  assert.equal(ADMIN_ROUTES.experimentalGames, '/admin/experimental-games');
  const navItem = ADMIN_NAV_ITEMS.find((item) => item.id === 'experimentalGames');
  assert.ok(navItem);
  assert.equal(navItem.href, ADMIN_ROUTES.experimentalGames);
  assert.match(navItem.label, /التجريبية/);

  const client = read('components/admin/admin-experimental-games-client.tsx');
  assert.match(client, /الألعاب التجريبية/);
  assert.match(client, /للاختبار فقط/);
  assert.match(client, /لا توجد ألعاب تجريبية مسجلة/);
});

test('direct URL renders no protected content outside AdminShell', () => {
  const page = read('app/admin/experimental-games/page.tsx');
  const shell = read('components/admin/admin-shell-client.tsx');
  assert.match(page, /<AdminShell>/);
  assert.match(page, /<AdminExperimentalGamesClient/);
  assert.match(shell, /fetchAdminMe\(\)/);
  assert.match(shell, /gate === 'forbidden'/);
  assert.match(shell, /router\.replace\(ADMIN_ROUTES\.login\)/);
});

test('registry contains closed-test games and keeps a useful empty fallback', () => {
  const registration = read(
    '../server/src/modules/game/experimental/register-experimental-games.ts',
  );
  const client = read('components/admin/admin-experimental-games-client.tsx');
  assert.match(registration, /secretAgentsExperimentalRegistration/);
  assert.match(registration, /emojiLanguageExperimentalRegistration/);
  assert.match(registration, /registerExperimentalGame/);
  assert.doesNotMatch(registration, /fake-game|placeholder-game/i);
  assert.match(client, /games\.length === 0/);
});

test('future launch uses authenticated room create then protected selection', () => {
  const client = read('components/admin/admin-experimental-games-client.tsx');
  const createIndex = client.indexOf('manager.create(user.preferredDisplayName)');
  const selectIndex = client.indexOf('SELECT_EXPERIMENTAL_GAME_EVENT', createIndex);
  const lobbyIndex = client.indexOf('router.push(buildLobbyUrl', selectIndex);
  assert.ok(createIndex >= 0);
  assert.ok(selectIndex > createIndex);
  assert.ok(lobbyIndex > selectIndex);
  assert.match(client, /user\?\.role !== 'ADMIN'/);
  assert.doesNotMatch(client, /isAdmin:\s*true|premium:\s*true|testMode:\s*true/);
});

test('invited guests adopt only the server-backed experimental room selection', () => {
  const context = read('contexts/room-context.tsx');
  assert.match(context, /const authoritativeGameId = room\?\.experimentalGameId \?\? null/);
  assert.match(context, /setSelectedGameId\(authoritativeGameId\)/);
  assert.match(context, /writeSelectedGameId\(authoritativeGameId\)/);
  assert.match(context, /localGameId && !isPlayableGameId\(localGameId\)/);
});

test('server-backed experimental selection can reach start without becoming publicly available', () => {
  const startPanel = read('components/lobby/lobby-start-game-panel.tsx');
  assert.match(
    startPanel,
    /catalogEntry\?\.availability === 'coming-soon'[\s\S]*room\?\.experimentalGameId !== selectedGameId/,
  );
  assert.match(
    startPanel,
    /room\?\.experimentalGameId !== selectedGameId[\s\S]*!isGameEnabled\(selectedGameId\)/,
  );
});

test('experimental games remain absent from public and ordinary lobby discovery', () => {
  const publicCatalog = read('lib/public/game-catalog.ts');
  const publicCards = read('components/public/game-cards.tsx');
  const lobbyGames = read('lib/lobby/mock-games.ts');
  const lobbyGrid = read('components/lobby/game-grid.tsx');
  const publicNav = read('components/public/public-navbar.tsx');
  const homeNav = read('components/home/home-navbar.tsx');
  for (const source of [publicCatalog, publicCards, lobbyGames, lobbyGrid, publicNav, homeNav]) {
    assert.doesNotMatch(source, /experimental-games|ExperimentalGameSummary|التجريبية/);
  }
  assert.doesNotMatch(publicCatalog, /secret-agents|العملاء السريون/);
  assert.doesNotMatch(lobbyGames, /secret-agents|العملاء السريون/);
  assert.doesNotMatch(publicCatalog, /emoji-language|لغة الإيموجي/);
  assert.doesNotMatch(lobbyGames, /emoji-language|لغة الإيموجي/);
});

test('admin data request uses the protected endpoint with credentials', () => {
  const api = read('lib/admin/api.ts');
  assert.match(api, /adminUrl\('\/experimental-games'\)/);
  assert.match(api, /credentials: 'include'/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
