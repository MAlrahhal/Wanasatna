/**
 * P5-B Home + Lobby product-surface contract tests.
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

const lightIsland = /#E2E8F0|#3B82F6|#F8FAFC|#0F172A|#2563EB/;

test('home create/join uses shared Field and Button', () => {
  const cards = read('components/public/room-action-cards.tsx');
  const home = read('app/(public)/home-page-client.tsx');
  assert.match(cards, /from '@\/components\/ui\/field'/);
  assert.match(cards, /from '@\/components\/ui\/button'/);
  assert.match(cards, /id="create-name"/);
  assert.match(cards, /id="join-code"/);
  assert.match(cards, /دخول الغرفة/);
  assert.match(cards, /إنشاء غرفة/);
  assert.match(cards, /placeholder="اكتب اسمك"/);
  assert.doesNotMatch(cards, /inviteFromLink/);
  assert.doesNotMatch(cards, /PublicField/);
  assert.doesNotMatch(cards, lightIsland);
  assert.match(home, /<Button/);
  assert.match(home, /ابدأ اللعب/);
  assert.match(home, /variant="primary"/);
  assert.doesNotMatch(home, /benefitChips/);
  assert.doesNotMatch(home, /حتى 8 لاعب/);
  assert.doesNotMatch(home, /عربي بالكامل/);
  assert.doesNotMatch(home, /انضم الآن/);
});

test('home has no light-theme form island regression', () => {
  const field = read('components/home/home-field.tsx');
  const unused = read('components/home/home-room-actions.tsx');
  const quick = read('components/home/home-quick-join.tsx');
  assert.match(field, /from '@\/components\/ui\/field'/);
  assert.doesNotMatch(field, lightIsland);
  assert.doesNotMatch(unused, lightIsland);
  assert.doesNotMatch(quick, lightIsland);
  assert.match(unused, /from '@\/components\/ui\/button'/);
});

test('active-room resume is visible with consistent copy', () => {
  const banner = read('components/public/active-room-banner.tsx');
  const home = read('app/(public)/home-page-client.tsx');
  const hook = read('lib/public/use-room-actions.ts');
  assert.match(banner, /لديك غرفة مفتوحة/);
  assert.match(banner, /يمكنك العودة إلى الغرفة/);
  assert.match(banner, /العودة كـ/);
  assert.match(banner, /enterFromJoinForm/);
  assert.match(banner, /HomeActiveRoomResume/);
  assert.match(home, /<HomeActiveRoomResume/);
  assert.match(home, /handleResumeClaim/);
  assert.match(hook, /handleResumeClaim/);
  assert.match(hook, /enterFromJoinForm\(resumeClaim\.roomCode, resumeClaim\.playerName\)/);
  assert.doesNotMatch(banner, /العودة للغرفة/);
});

test('home validation uses Field errors and SystemStatus for action failures', () => {
  const home = read('app/(public)/home-page-client.tsx');
  const hook = read('lib/public/use-room-actions.ts');
  assert.match(home, /SystemStatus/);
  assert.match(home, /playerNameError/);
  assert.match(home, /joinCodeError/);
  assert.match(hook, /يرجى إدخال اسمك لإنشاء غرفة/);
  assert.match(hook, /يرجى إدخال رمز الغرفة/);
});

test('lobby kick requires UiDialog confirmation before socket action', () => {
  const panel = read('components/lobby/players-panel.tsx');
  const card = read('components/lobby/player-card.tsx');
  assert.match(panel, /UiDialog/);
  assert.match(panel, /طرد اللاعب؟/);
  assert.match(panel, /هل أنت متأكد أنك تريد طرد/);
  assert.match(panel, /confirmLabel="طرد"/);
  assert.match(panel, /onKickPlayer\?\.\(kickTarget\.id\)/);
  assert.doesNotMatch(card, /kickPlayer/);
  assert.match(card, /onKick\?\.\(player\.id\)/);
});

test('lobby leave uses shared dialog and consistent wording', () => {
  const header = read('components/lobby/lobby-header.tsx');
  assert.match(header, /from '@\/components\/ui\/button'/);
  assert.match(header, /UiDialog/);
  assert.match(header, /مغادرة الغرفة/);
  assert.match(header, /قفل الغرفة/);
  assert.match(header, /فتح الغرفة/);
  assert.match(header, /الغرفة مقفلة/);
  assert.match(header, /الغرفة مفتوحة/);
  assert.match(header, /variant="destructive"/);
  assert.match(header, /buildRoomInviteUrl/);
  assert.match(header, /تم نسخ الرابط/);
  assert.doesNotMatch(header, /navigator\.share/);
  assert.match(header, /إنهاء الغرفة/);
  assert.match(header, /سيتم إنهاء الغرفة وإخراج جميع اللاعبين منها/);
  assert.match(header, /\{isHost \? \(/);
  assert.match(header, /تغيير الأيقونة/);
  assert.match(header, /onChangeAvatar/);
});

test('game settings heading has no helper subtitle', () => {
  const panel = read('components/lobby/game-settings-panel.tsx');
  assert.match(panel, /إعدادات اللعبة/);
  assert.doesNotMatch(panel, /يمكن للمضيف تعديل الإعدادات عند توفرها/);
});

test('selected game and host/non-host catalog states are explicit', () => {
  const card = read('components/lobby/game-card.tsx');
  const grid = read('components/lobby/game-grid.tsx');
  assert.match(card, /✓ مختارة/);
  assert.match(card, /aria-pressed=\{selected\}/);
  assert.match(card, /aria-disabled="true"/);
  assert.match(card, /border-wanas-accent bg-wanas-accent\/10/);
  assert.match(grid, /اختيار اللعبة متاح للمضيف فقط/);
});

test('settings empty state and start CTA are honest', () => {
  const settings = read('components/lobby/game-settings-panel.tsx');
  const start = read('components/lobby/lobby-start-game-panel.tsx');
  assert.match(settings, /لا توجد إعدادات إضافية لهذه اللعبة/);
  assert.match(start, /from '@\/components\/ui\/button'/);
  assert.match(start, /بدء اللعبة/);
  assert.match(start, /بانتظار المضيف لبدء اللعبة/);
  assert.match(start, /loading=\{isStarting\}/);
  assert.doesNotMatch(start, /⏳/);
});

test('lobby chat is live and secondary', () => {
  const chat = read('components/lobby/lobby-chat.tsx');
  const screen = read('components/lobby/lobby-screen.tsx');
  assert.match(chat, /RoomChatPanel/);
  assert.doesNotMatch(chat, /➤/);
  assert.match(screen, /minmax\(168px,200px\)/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
