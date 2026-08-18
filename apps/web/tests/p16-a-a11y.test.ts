/**
 * P16-A — core accessibility contracts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM_COPY } from '../lib/ui/system-copy';
import { ADMIN_COPY } from '../lib/admin/copy';

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

test('1 html ar + rtl', () => {
  const layout = read('app/layout.tsx');
  assert.match(layout, /lang="ar"/);
  assert.match(layout, /dir="rtl"/);
});

test('2-3 skip link and main target', () => {
  assert.match(read('components/public/skip-to-content.tsx'), /تجاوز إلى المحتوى/);
  assert.match(read('components/public/skip-to-content.tsx'), /#main-content/);
  assert.match(read('app/layout.tsx'), /SkipToContent/);
  assert.match(read('app/globals.css'), /wanas-skip-link/);
  assert.match(read('components/public/public-layout-client.tsx'), /id="main-content"/);
  assert.match(read('app/(room)/lobby/page.tsx'), /id="main-content"/);
  assert.match(read('app/(room)/game/layout.tsx'), /id="main-content"/);
  assert.match(read('app/(room)/game/layout.tsx'), /<main/);
  assert.doesNotMatch(read('app/(room)/game/page.tsx'), /<main/);
  assert.doesNotMatch(read('components/game-experience/game-experience-shell.tsx'), /<main/);
  assert.match(read('components/admin/admin-shell-client.tsx'), /id="main-content"/);
});

test('4 Home fields labeled', () => {
  const cards = read('components/public/room-action-cards.tsx');
  const field = read('components/ui/field.tsx');
  assert.match(field, /htmlFor=\{id\}/);
  assert.match(cards, /label="اسمك"/);
  assert.match(cards, /label="رمز الغرفة"/);
  assert.match(cards, /autoComplete="nickname"/);
  assert.match(cards, /autoComplete="one-time-code"/);
});

test('5 login fields labeled', () => {
  const login = read('app/(public)/login/login-page-client.tsx');
  assert.match(login, /AUTH_COPY\.emailLabel/);
  assert.match(login, /AUTH_COPY\.passwordLabel/);
  assert.match(login, /autoComplete="email"/);
  assert.match(login, /autoComplete=\{mode === 'register' \? 'new-password' : 'current-password'\}/);
  assert.match(login, /role="alert"/);
});

test('6 chat input/button named; messages not live-spammed', () => {
  const chat = read('components/room/room-chat-panel.tsx');
  assert.match(chat, /htmlFor=\{`room-chat-input-\$\{variant\}`\}/);
  assert.match(chat, /SYSTEM_COPY\.chatSend/);
  assert.match(chat, /aria-label=\{SYSTEM_COPY\.chatTitle\}/);
  assert.match(chat, /aria-live="off"/);
  assert.match(chat, /role="alert"/);
  assert.doesNotMatch(chat, /aria-live="assertive"/);
  assert.doesNotMatch(chat, /messages\.map[\s\S]*aria-live/);
});

test('7 mobile menu accessible', () => {
  const nav = read('components/public/public-navbar.tsx');
  const mobile = read('components/public/mobile-navigation.tsx');
  assert.match(nav, /aria-controls="public-mobile-nav"/);
  assert.match(nav, /aria-expanded=\{mobileOpen\}/);
  assert.match(nav, /mobileToggleRef\.current\?\.focus/);
  assert.match(nav, /Escape/);
  assert.match(mobile, /aria-label="التنقل للجوال"/);
  assert.match(mobile, /<nav/);
});

test('8 Admin destructive dialogs accessible', () => {
  const detail = read('components/admin/admin-room-detail-client.tsx');
  assert.match(detail, /role="dialog"/);
  assert.match(detail, /aria-modal="true"/);
  assert.match(detail, /ADMIN_COPY\.kickConfirm/);
  assert.match(detail, /ADMIN_COPY\.kickConfirmCta/);
  assert.match(detail, /ADMIN_COPY\.closeConfirmCta/);
  assert.match(detail, /ADMIN_COPY\.cancel/);
  assert.match(detail, /Escape/);
  assert.equal(ADMIN_COPY.kickConfirmCta, 'طرد اللاعب');
});

test('9 icon-only controls labeled', () => {
  assert.match(read('components/public/public-navbar.tsx'), /aria-label=\{mobileOpen \? 'إغلاق القائمة' : 'فتح القائمة'\}/);
  assert.match(read('plugins/draw-guess/drawing-toolbar.tsx'), /aria-label=\{preset\.label\}/);
  assert.match(read('components/lobby/lobby-screen.tsx'), /aria-label="إغلاق"/);
});

test('10 selected/disabled states exposed', () => {
  assert.match(read('components/lobby/game-card.tsx'), /aria-pressed=\{selected\}/);
  assert.match(read('plugins/draw-guess/drawing-toolbar.tsx'), /aria-pressed=\{tool === 'draw'\}/);
  assert.match(read('plugins/bara-al-salafa/voting-screen.tsx'), /aria-pressed=\{selected\}/);
  assert.match(read('components/admin/admin-games-client.tsx'), /aria-pressed=\{isEnabled\}/);
  assert.match(read('components/ui/button.tsx'), /disabled=\{disabled \|\| loading\}/);
});

test('11 spectator status accessible', () => {
  assert.equal(SYSTEM_COPY.spectator, 'أنت متفرج في هذه الجولة');
  const notice = read('components/room/room-system-state.tsx');
  assert.match(notice, /SYSTEM_COPY\.spectator/);
  assert.match(read('components/ui/system-status.tsx'), /role=\{tone === 'error' \|\| tone === 'disconnected' \? 'alert' : 'status'\}/);
});

test('12 timers avoid 1Hz aria-live spam', () => {
  const chip = read('components/game/game-timer-chip.tsx');
  assert.match(chip, /aria-label=\{`الوقت المتبقي \$\{label\}`\}/);
  assert.match(chip, /role="timer"/);
  assert.doesNotMatch(chip, /aria-live/);
});

test('13 GC Blue/Red labeled textually', () => {
  assert.match(read('components/lobby/team-assignment-panel.tsx'), /title="الفريق الأزرق"/);
  assert.match(read('components/lobby/team-assignment-panel.tsx'), /title="الفريق الأحمر"/);
  assert.match(read('components/lobby/team-assignment-panel.tsx'), /الفريق الأزرق/);
  assert.match(read('plugins/guessing-challenge/game-screen.tsx'), /الفريق الأزرق/);
  assert.match(read('plugins/guessing-challenge/game-screen.tsx'), /الفريق الأحمر/);
});

test('14 public game links have context', () => {
  const cards = read('components/public/game-cards.tsx');
  assert.match(cards, /aria-label=\{`اعرف أكثر عن \$\{game\.title\}`\}/);
});

test('15 Admin tables have headers', () => {
  assert.match(read('components/admin/admin-rooms-client.tsx'), /<th/);
  assert.match(read('components/admin/admin-history-client.tsx'), /<th/);
  assert.match(read('components/admin/admin-analytics-client.tsx'), /<th/);
  assert.match(read('components/admin/admin-users-client.tsx'), /htmlFor="admin-user-search"/);
});

test('16 errors expose alert/status semantics', () => {
  assert.match(read('app/(public)/login/login-page-client.tsx'), /role="alert"/);
  assert.match(read('components/ui/system-status.tsx'), /role=\{tone === 'error'/);
  assert.match(read('components/room/room-chat-panel.tsx'), /role="alert"/);
});

test('17 reduced-motion CSS exists', () => {
  assert.match(read('app/globals.css'), /prefers-reduced-motion: reduce/);
  assert.match(read('styles/game-theme.css'), /prefers-reduced-motion: reduce/);
});

test('18-19 keyboard actions remain native; no gameplay logic change in a11y files', () => {
  assert.match(read('components/ui/dialog.tsx'), /event\.key === 'Escape'/);
  assert.match(read('components/ui/dialog.tsx'), /previousFocusRef/);
  assert.match(read('components/public/public-navbar.tsx'), /type="button"/);
  assert.match(read('components/lobby/game-card.tsx'), /<button/);
  assert.doesNotMatch(read('components/public/skip-to-content.tsx'), /emit\(|socket/);
  assert.doesNotMatch(read('app/layout.tsx'), /minPlayers|maxPlayers|validateStart/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
