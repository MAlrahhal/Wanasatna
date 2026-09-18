/** QA-76: mobile chat interaction, short-landscape layout, and safe-area contracts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const lobby = read('components/lobby/lobby-screen.tsx');
const lobbyChat = read('components/lobby/lobby-chat.tsx');
const game = read('components/game-experience/game-experience-shell.tsx');
const panel = read('components/room/room-chat-panel.tsx');
const css = read('app/globals.css');
const layout = read('app/layout.tsx');
const scrollLock = read('lib/ui/use-mobile-overlay-scroll-lock.ts');

let passed = 0;
let failed = 0;

function test(name: string, run: () => void) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

test('lobby chat opens from one standard click and closes directly', () => {
  assert.match(lobby, /onClick=\{\(\) => setChatOpen\(true\)\}/);
  assert.match(lobby, /onClick=\{\(\) => setChatOpen\(false\)\}/);
  assert.doesNotMatch(lobby, /setTimeout\([^)]*setChatOpen/);
});

test('game chat supports repeated toggles without outside-click racing its controls', () => {
  assert.match(game, /setChatOpen\(\(open\) => !open\)/);
  assert.match(game, /mobilePanelControlsRef\.current\?\.contains\(event\.target\)/);
  assert.match(game, /activePanel\?\.contains\(event\.target\)/);
  assert.match(game, /onClick=\{\(\) => setChatOpen\(false\)\}/);
});

test('lobby chat stays above the fixed Start bar so the composer receives taps', () => {
  assert.match(lobby, /mobile-room-chat-sheet[\s\S]{0,240}?z-50/);
  const start = read('components/lobby/lobby-start-game-panel.tsx');
  assert.match(start, /data-lobby-sticky-start[\s\S]{0,180}?z-40/);
});

test('short landscape gives Games, Players, and Chat equal usable columns', () => {
  assert.match(lobby, /lobby-mobile-section-controls/);
  assert.match(css, /orientation:\s*landscape/);
  assert.match(css, /max-height:\s*560px/);
  assert.match(css, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.equal((lobby.match(/min-w-11/g) ?? []).length >= 3, true);
});

test('short landscape chat uses the available dynamic viewport', () => {
  assert.match(css, /\.mobile-room-chat-sheet\s*\{[\s\S]*?height:\s*100dvh/);
  assert.match(css, /max-height:\s*100dvh/);
  assert.match(lobbyChat, /mobileSheetOpen \? 'h-full flex-1'/);
  assert.match(lobby, /h-\[55dvh\] max-h-\[55dvh\]/);
  assert.match(game, /h-\[45dvh\] max-h-\[45dvh\]/);
});

test('both chat sheets protect every physical safe-area edge', () => {
  for (const source of [lobby, game]) {
    assert.match(source, /safe-area-inset-top/);
    assert.match(source, /safe-area-inset-right/);
    assert.match(source, /safe-area-inset-bottom/);
    assert.match(source, /safe-area-inset-left/);
  }
  assert.match(layout, /viewportFit:\s*["']cover["']/);
});

test('composer remains a one-tap native input without forced open-time focus', () => {
  assert.match(panel, /ref=\{inputRef\}/);
  assert.match(panel, /h-11 min-h-11 min-w-0 flex-1/);
  assert.match(panel, /text-base[\s\S]{0,180}?lg:text-sm/);
  assert.doesNotMatch(lobby, /inputRef|\.focus\(/);
  assert.doesNotMatch(game, /inputRef|\.focus\(/);
});

test('mobile overlay locks background scroll and restores desktop behavior on resize', () => {
  assert.match(lobby, /useMobileOverlayScrollLock\(chatOpen, '\(max-width: 1279px\)'\)/);
  assert.match(game, /useMobileOverlayScrollLock\(chatOpen, '\(max-width: 1023px\)'\)/);
  assert.match(scrollLock, /window\.matchMedia\(mediaQuery\)/);
  assert.match(scrollLock, /root\.style\.overflow = 'hidden'/);
  assert.match(scrollLock, /body\.style\.overflow = 'hidden'/);
  assert.match(scrollLock, /query\.addEventListener\('change', syncLock\)/);
  assert.match(scrollLock, /root\.style\.overflow = previousRootOverflow/);
});

test('portrait and desktop layout contracts remain scoped and RTL', () => {
  assert.match(lobby, /className="lobby-mobile-section-controls flex gap-2 xl:hidden"/);
  assert.match(lobby, /xl:static[\s\S]{0,180}?xl:flex/);
  assert.match(game, /lg:hidden/);
  assert.match(panel, /dir="rtl"/);
  assert.match(layout, /dir="rtl"/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
