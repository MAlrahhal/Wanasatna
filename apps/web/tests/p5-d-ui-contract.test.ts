/**
 * P5-D cross-game visual consistency contract tests.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { presentSystemCopy, SYSTEM_COPY } from '../lib/ui/system-copy';

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

const GAME_SCREENS = [
  'plugins/bara-al-salafa/game-screen.tsx',
  'plugins/draw-guess/game-screen.tsx',
  'plugins/imposter-draw/game-screen.tsx',
  'plugins/timing-challenge/game-screen.tsx',
  'plugins/fast-answer/game-screen.tsx',
  'plugins/who-wrote-it/game-screen.tsx',
  'plugins/judge/game-screen.tsx',
  'plugins/guessing-challenge/game-screen.tsx',
] as const;

test('presentSystemCopy normalizes ASCII ellipsis for display', () => {
  assert.equal(presentSystemCopy('الجولة التالية تبدأ تلقائياً...'), SYSTEM_COPY.nextRoundAuto);
  assert.equal(
    presentSystemCopy(null, SYSTEM_COPY.nextRoundAuto),
    SYSTEM_COPY.nextRoundAuto,
  );
  assert.equal(presentSystemCopy('التالي الآن'), 'التالي الآن');
});

test('legacy GameHeader is a no-op under the Experience Shell', () => {
  const header = read('components/game/game-header.tsx');
  assert.match(header, /useGameExperienceShellActive/);
  assert.match(header, /if \(shellActive\) \{\s*return null;/);
});

test('GameScreen default density is compact shared chrome', () => {
  const card = read('components/game/game-card.tsx');
  assert.match(card, /gap-4 sm:gap-5/);
  assert.doesNotMatch(card, /gap-6 sm:gap-7 lg:gap-8/);
});

test('spectator body copy is the notice sentence, not a duplicate header title', () => {
  const notice = read('components/room/room-system-state.tsx');
  assert.match(notice, /title=\{SYSTEM_COPY\.spectator\}/);
  assert.doesNotMatch(notice, /title=\{SYSTEM_COPY\.spectatorTitle\}/);
});

test('all eight games clear experience meta on unmount', () => {
  for (const screen of GAME_SCREENS) {
    assert.match(
      read(screen),
      /useEffect\(\(\) => \(\) => setExperienceMeta\(null\), \[setExperienceMeta\]\)/,
      screen,
    );
  }
});

test('timing, imposter, and guessing spectators use SpectatorNotice', () => {
  assert.match(read('plugins/timing-challenge/game-screen.tsx'), /SpectatorNotice/);
  assert.match(read('plugins/imposter-draw/game-screen.tsx'), /SpectatorNotice/);
  assert.match(read('plugins/guessing-challenge/game-screen.tsx'), /SpectatorNotice/);
  assert.doesNotMatch(read('plugins/timing-challenge/game-screen.tsx'), /أنت مشاهد/);
  assert.doesNotMatch(read('plugins/imposter-draw/game-screen.tsx'), /أنت مشاهد/);
  assert.doesNotMatch(read('plugins/guessing-challenge/game-screen.tsx'), /أنت مشاهد حالياً/);
});

test('round-results screens do not hardcode ASCII auto-progress fallbacks', () => {
  const files = [
    'plugins/bara-al-salafa/round-results-screen.tsx',
    'plugins/draw-guess/round-results-screen.tsx',
    'plugins/imposter-draw/round-results-screen.tsx',
    'plugins/timing-challenge/round-results-screen.tsx',
    'plugins/fast-answer/round-results-screen.tsx',
    'plugins/who-wrote-it/round-results-screen.tsx',
    'plugins/judge/round-results-screen.tsx',
    'plugins/guessing-challenge/round-results-screen.tsx',
  ];
  for (const file of files) {
    const source = read(file);
    assert.match(source, /presentSystemCopy/, file);
    assert.doesNotMatch(source, /الجولة التالية تبدأ تلقائياً\.\.\./, file);
  }
});

test('production game UI has no finishing-match leftover copy', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(full);
      }
      return entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') ? [full] : [];
    });
  }

  const plugins = walk(join(root, 'plugins'));
  const components = walk(join(root, 'components'));
  for (const file of [...plugins, ...components]) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /جاري إنهاء المباراة/, file);
    assert.doesNotMatch(source, /جاري تحميل اللعبة/, file);
    assert.doesNotMatch(source, /navigator\.share/, file);
  }
});

test('countdown does not repeat round metadata already in the header chip', () => {
  const countdown = read('plugins/bara-al-salafa/countdown-screen.tsx');
  assert.match(countdown, /بتبدأ الجولة الآن/);
  assert.doesNotMatch(countdown, /الجولة \{roundNumber\} من \{totalRounds\}/);
});

test('leaderboard current-player badge is readable', () => {
  const panel = read('components/game-experience/game-leaderboard-panel.tsx');
  assert.match(panel, /أنت/);
  assert.match(panel, /text-xs font-semibold leading-4 text-wanas-accent/);
});

test('primary CTA remains white and chat stays honest', () => {
  const button = read('components/ui/button.tsx');
  const chat = read('components/game-experience/game-chat-mock-panel.tsx');
  const panel = read('components/room/room-chat-panel.tsx');
  assert.match(button, /primary:\s*'[\s\S]*text-white/);
  assert.match(chat, /RoomChatPanel/);
  assert.doesNotMatch(panel, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(chat, /MOCK_MESSAGES/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
