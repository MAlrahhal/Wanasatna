/**
 * P6-A Home + Invite + Lobby mobile shell contract tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitGameStartPlayerRequirementReason } from '../lib/game-shell/start-requirement-copy';

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

function firstIndex(source: string, snippet: string): number {
  const index = source.indexOf(snippet);
  assert.notEqual(index, -1, `missing ${snippet}`);
  return index;
}

test('mobile public navbar is compact without changing desktop height', () => {
  const navbar = read('components/public/public-navbar.tsx');
  assert.match(navbar, /h-14/);
  assert.match(navbar, /lg:h-\[72px\]/);
  assert.match(navbar, /size-11/);
  assert.match(navbar, /aria-label=\{mobileOpen \? 'إغلاق القائمة' : 'فتح القائمة'\}/);
  assert.doesNotMatch(navbar, /flex h-\[72px\] max-w-6xl/);
});

test('invite remains focused and does not regain Home marketing', () => {
  const home = read('app/(public)/home-page-client.tsx');
  const invite = read('components/public/invite-join-card.tsx');
  const start = home.indexOf('if (room.inviteFromLink)');
  const firstReturn = home.indexOf('return (', start);
  const secondReturn = home.indexOf('return (', firstReturn + 1);
  const inviteBranch = home.slice(start, secondReturn);

  assert.match(inviteBranch, /InviteJoinCard/);
  assert.doesNotMatch(inviteBranch, /RoomActionCards/);
  assert.doesNotMatch(inviteBranch, /FeatureCard/);
  assert.match(invite, /دخول الغرفة/);
  assert.match(invite, /id="join-name"/);
  assert.match(invite, /id="join-code"/);
  assert.match(invite, /readOnly/);
  assert.match(invite, /dir="ltr"/);
  assert.doesNotMatch(invite, /onCreateRoom/);
  assert.doesNotMatch(invite, /min-h-\[calc\(100vh-7\.5rem\)\]/);
});

test('mobile lobby session chrome hides public navbar/footer below xl', () => {
  const page = read('components/lobby/lobby-page-client.tsx');
  assert.match(page, /hidden xl:block/);
  assert.match(page, /<PublicNavbar/);
  assert.match(page, /<PublicFooter/);
  const navbarWrap = page.indexOf('hidden xl:block');
  const navbar = page.indexOf('<PublicNavbar');
  const footer = page.indexOf('<PublicFooter');
  assert.ok(navbarWrap < navbar);
  assert.ok(page.indexOf('hidden xl:block', navbarWrap + 1) < footer);
});

test('mobile primary tabs are games + players only; chat is a drawer', () => {
  const screen = read('components/lobby/lobby-screen.tsx');
  const chat = read('components/lobby/lobby-chat.tsx');
  assert.match(screen, /\['games', 'الألعاب'\]/);
  assert.match(screen, /\['players', 'اللاعبون'\]/);
  assert.doesNotMatch(screen, /\['chat', 'الدردشة'\]/);
  assert.doesNotMatch(screen, /'games' \| 'players' \| 'chat'/);
  assert.match(screen, /xl:order-3 xl:block/);
  assert.match(screen, /<LobbyChat/);
  assert.match(screen, /minmax\(168px,200px\)/);
  assert.match(screen, /aria-label="الدردشة"/);
  assert.match(chat, /RoomChatPanel/);
});

test('mobile catalog is 1-col at 320 and 2-col from 360; desktop 3-col remains', () => {
  const grid = read('components/lobby/game-grid.tsx');
  const card = read('components/lobby/game-card.tsx');
  assert.match(grid, /grid-cols-1/);
  assert.match(grid, /min-\[360px\]:grid-cols-2/);
  assert.match(grid, /xl:grid-cols-3/);
  assert.doesNotMatch(grid, /sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(card, /xl:min-h-\[168px\]/);
  assert.match(card, /line-clamp-2/);
  assert.match(card, /✓ مختارة/);
  assert.match(card, /aria-pressed=\{selected\}/);
});

test('sticky Start is host/mobile-only and reuses startGame validation', () => {
  const start = read('components/lobby/lobby-start-game-panel.tsx');
  const hostReturn = start.indexOf('if (!isHost)');
  const sticky = start.indexOf('data-lobby-sticky-start');
  assert.ok(hostReturn !== -1);
  assert.ok(sticky > hostReturn);
  assert.match(start, /xl:hidden/);
  assert.match(start, /hidden[\s\S]*xl:block/);
  assert.match(start, /env\(safe-area-inset-bottom/);
  assert.match(start, /await startGame\(\)/);
  assert.match(start, /getGameStartPlayerRequirementReason/);
  assert.match(start, /loading=\{isStarting\}/);
  assert.match(start, /بانتظار المضيف لبدء اللعبة/);
  assert.doesNotMatch(start.slice(hostReturn, sticky), /data-lobby-sticky-start/);
});

test('Marathon → Category → Settings → Start order is preserved', () => {
  const screen = read('components/lobby/lobby-screen.tsx');
  const catalog = firstIndex(screen, '<GameGrid');
  const marathon = firstIndex(screen, '<LobbyMarathonBanner');
  const category = firstIndex(screen, '<RoundCategoryPanel');
  const settings = firstIndex(screen, '<GameSettingsPanel');
  const start = firstIndex(screen, '<LobbyStartGamePanel');
  assert.ok(catalog < marathon);
  assert.ok(marathon < category);
  assert.ok(category < settings);
  assert.ok(settings < start);
});

test('room-link copy and single lobby hamburger are unchanged in intent', () => {
  const header = read('components/lobby/lobby-header.tsx');
  assert.match(header, /buildRoomInviteUrl/);
  assert.match(header, /تم نسخ الرابط/);
  assert.doesNotMatch(header, /navigator\.share/);
  assert.match(header, /aria-label=\{menuOpen \? 'إغلاق قائمة الغرفة' : 'فتح قائمة الغرفة'\}/);
  assert.match(header, /xl:hidden/);
  assert.match(header, /hidden xl:flex/);
});

test('player count is LTR-safe and kick stays dialog-backed', () => {
  const panel = read('components/lobby/players-panel.tsx');
  assert.match(panel, /dir="ltr"/);
  assert.match(panel, /players\.length/);
  assert.match(panel, /MAX_ROOM_PLAYERS/);
  assert.match(panel, /UiDialog/);
  assert.match(panel, /confirmLabel="طرد"/);
});

test('safe-area viewport metadata is configured', () => {
  const layout = read('app/layout.tsx');
  assert.match(layout, /export const viewport/);
  assert.match(layout, /viewportFit:\s*['"]cover['"]/);
});

test('category chips keep 10 options and larger mobile touch targets', () => {
  const panel = read('components/lobby/round-category-panel.tsx');
  const categories = read('lib/game/round-categories/bara-al-salafa.ts');
  assert.match(panel, /h-10 min-h-10/);
  assert.match(panel, /onSelectCategory\(category\.id\)/);
  assert.match(panel, /bg-wanas-accent text-white/);
  assert.match(categories, /عشوائي/);
  assert.match(categories, /defaultCategoryId: 'random'/);
});

test('min-player error emphasizes the dynamic game name without changing copy', () => {
  const start = read('components/lobby/lobby-start-game-panel.tsx');
  const validation = read('lib/game-shell/start-validation.ts');
  assert.match(start, /splitGameStartPlayerRequirementReason/);
  assert.match(start, /font-semibold text-white/);
  assert.match(validation, /تحتاج لعبة \$\{plugin!\.metadata\.title\} إلى \$\{minPlayers\} لاعبين على الأقل\./);
  assert.match(validation, /تحتاج لعبة برا السالفة إلى 3 لاعبين على الأقل\./);

  const whoWroteIt = splitGameStartPlayerRequirementReason(
    'تحتاج لعبة من كتبها؟ إلى 3 لاعبين على الأقل.',
  );
  assert.deepEqual(whoWroteIt, {
    before: 'تحتاج لعبة ',
    gameName: 'من كتبها؟',
    after: ' إلى 3 لاعبين على الأقل.',
  });
  assert.equal(
    splitGameStartPlayerRequirementReason('تحدي التخمين (1 ضد 1) يلزم لاعبان.'),
    null,
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
