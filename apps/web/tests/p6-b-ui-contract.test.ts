/**
 * P6-B mobile game shell + 2D games presentation contract tests.
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

test('mobile header uses a deliberate compact two-row structure', () => {
  const header = read('components/game-experience/game-experience-header.tsx');
  assert.match(header, /flex flex-col gap-1\.5 md:hidden/);
  assert.match(header, /hidden md:grid md:grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
  assert.match(header, /primaryCenter/);
  assert.match(header, /secondaryChip/);
  assert.match(header, /normalizeExperiencePhaseLabel/);
  assert.doesNotMatch(header, /absolute left-1\/2/);
  assert.doesNotMatch(header, /⚙/);
  assert.match(header, /aria-label="إدارة الغرفة"/);
  assert.match(header, /phaseLabelRaw !== meta\.gameName/);
});

test('mobile game chrome has leaderboard and collapsible chat', () => {
  const shell = read('components/game-experience/game-experience-shell.tsx');
  const chat = read('components/game-experience/game-chat-mock-panel.tsx');
  const panel = read('components/room/room-chat-panel.tsx');
  assert.match(shell, /aria-label="الترتيب"/);
  assert.match(shell, /aria-label="الدردشة"/);
  assert.match(shell, /<GameChatMockPanel/);
  assert.match(shell, /lg:grid lg:grid-cols-/);
  assert.doesNotMatch(shell, /panel="chat"/);
  assert.doesNotMatch(shell, /mobilePanel === 'chat'/);
  assert.match(chat, /RoomChatPanel/);
  assert.doesNotMatch(panel, /dangerouslySetInnerHTML/);
});

test('leaderboard sheet and room management keep safe-area and scroll limits', () => {
  const shell = read('components/game-experience/game-experience-shell.tsx');
  const room = read('components/game-experience/game-room-management-dialog.tsx');
  const board = read('components/game-experience/game-leaderboard-panel.tsx');
  assert.match(shell, /max-h-\[55dvh\]/);
  assert.match(shell, /env\(safe-area-inset-bottom/);
  assert.match(room, /items-end/);
  assert.match(room, /max-h-\[min\(88dvh,100%\)\]/);
  assert.match(room, /env\(safe-area-inset-bottom/);
  assert.match(room, /buildRoomInviteUrl/);
  assert.doesNotMatch(room, /navigator\.share/);
  assert.match(board, /أنت/);
  assert.match(board, /competitionDisplayRanks/);
});

test('drawing canvas keeps touch-none and maps pointer coords from displayed size', () => {
  const canvas = read('plugins/draw-guess/drawing-canvas.tsx');
  const toolbar = read('plugins/draw-guess/drawing-toolbar.tsx');
  const drawing = read('plugins/draw-guess/drawing-screen.tsx');
  const imposter = read('plugins/imposter-draw/drawing-turns-screen.tsx');
  assert.match(canvas, /touch-none/);
  assert.match(canvas, /getBoundingClientRect/);
  assert.match(canvas, /CANVAS_WIDTH/);
  assert.match(canvas, /h-\[min\(36dvh,_240px\)\]/);
  assert.match(canvas, /min-h-\[10rem\]/);
  assert.match(toolbar, /overflow-x-auto/);
  assert.match(toolbar, /aria-pressed=\{selected\}/);
  assert.match(toolbar, /min-h-11/);
  assert.match(toolbar, /aria-label=\{`حجم الفرشاة \$\{brushSize\}`\}/);
  assert.doesNotMatch(toolbar, /حجم الفرشاة<\/p>/);
  assert.match(drawing, /flex flex-col gap-2/);
  assert.match(drawing, /isDrawer \? \(/);
  assert.match(drawing, /<DrawingToolbar/);
  assert.match(drawing, /<GuessPanel/);
  assert.match(imposter, /canDraw \? \(/);
  assert.match(imposter, /<DrawingToolbar/);
});

test('text-entry games use mobile sticky submit without changing handlers', () => {
  const fast = read('plugins/fast-answer/question-screen.tsx');
  const who = read('plugins/who-wrote-it/answering-screen.tsx');
  const judgeAnswer = read('plugins/judge/answering-screen.tsx');
  const judge = read('plugins/judge/judging-screen.tsx');
  const guess = read('plugins/draw-guess/guess-panel.tsx');
  const sticky = read('components/game/game-mobile-sticky-cta.tsx');
  assert.match(sticky, /lg:hidden/);
  assert.match(sticky, /env\(safe-area-inset-bottom/);
  assert.match(fast, /GameMobileStickyCta/);
  assert.match(fast, /shouldAutofocusFormField/);
  assert.match(fast, /onSubmit\(trimmed\)/);
  assert.match(who, /GameMobileStickyCta/);
  assert.match(who, /onSubmit\(trimmed\)/);
  assert.match(judgeAnswer, /GameMobileStickyCta/);
  assert.match(judge, /تأكيد الاختيار/);
  assert.match(judge, /GameMobileStickyCta/);
  assert.match(judge, /onSelectWinner\(selectedAnswerId\)/);
  assert.match(guess, /GameMobileStickyCta/);
  assert.match(guess, /onSubmit\(trimmed\)/);
});

test('mobile result/timer surfaces avoid rigid desktop-only widths', () => {
  const timing = read('plugins/timing-challenge/electronic-panel.tsx');
  const results = read('plugins/bara-al-salafa/round-results-screen.tsx');
  const match = read('plugins/bara-al-salafa/match-results-screen.tsx');
  assert.doesNotMatch(timing, /min-w-\[12\.5rem\]/);
  assert.match(timing, /max-w-\[12\.5rem\]/);
  assert.match(timing, /min-w-0/);
  assert.match(results, /h-\[5\.25rem\]/);
  assert.match(match, /العودة إلى اللوبي/);
  assert.doesNotMatch(match, /min-w-\[12\.5rem\]/);
});

test('autofocus helper is desktop-only', () => {
  const helper = read('lib/ui/should-autofocus-form-field.ts');
  assert.match(helper, /min-width: 1024px/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
