import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const roundResultFiles = [
  'plugins/bara-al-salafa/round-results-screen.tsx',
  'plugins/draw-guess/round-results-screen.tsx',
  'plugins/fast-answer/round-results-screen.tsx',
  'plugins/guessing-challenge/round-results-screen.tsx',
  'plugins/imposter-draw/round-results-screen.tsx',
  'plugins/judge/round-results-screen.tsx',
  'plugins/timing-challenge/round-results-screen.tsx',
  'plugins/who-wrote-it/round-results-screen.tsx',
] as const;

const gameScreenFiles = roundResultFiles.map((file) =>
  file.replace('round-results-screen.tsx', 'game-screen.tsx'),
);

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function count(source: string, value: string): number {
  return source.split(value).length - 1;
}

const placeholder = read('components/ads/ad-placeholder.tsx');
assert.match(placeholder, /process\.env\.NODE_ENV === 'production'[\s\S]*return null/);
assert.match(placeholder, /data-ad-placement=\{placement\}/);
assert.match(placeholder, /مساحة إعلانية/);
assert.doesNotMatch(placeholder, /onClick|<script|adsbygoogle|data-ad-slot|ca-pub|pub-\d/);

const home = read('app/(public)/home-page-client.tsx');
assert.equal(count(home, 'placement="home-'), 2);
assert.ok(home.indexOf('home-before-room-actions') < home.indexOf('<RoomActionCards'));
assert.ok(home.indexOf('home-after-games') > home.indexOf('featuredGames.map'));

const lobby = read('components/lobby/lobby-screen.tsx');
assert.equal(count(lobby, 'placement="lobby-'), 3);
assert.match(lobby, /placement="lobby-chat-desktop"[\s\S]*?hidden[\s\S]*?xl:flex/);
assert.match(lobby, /placement="lobby-players-desktop"[\s\S]*?hidden[\s\S]*?xl:flex/);
assert.match(lobby, /placement="lobby-mobile"[\s\S]*?xl:hidden/);

const gameShell = read('components/game-experience/game-experience-shell.tsx');
assert.equal(count(gameShell, 'placement="game-'), 2);
assert.match(gameShell, /meta\.layoutMode === 'gameplay'/);
assert.match(gameShell, /placement="game-chat-desktop"[\s\S]*?hidden[\s\S]*?2xl:flex/);
assert.match(gameShell, /placement="game-leaderboard-desktop"[\s\S]*?hidden[\s\S]*?2xl:flex/);
const mobileGameShell = gameShell.slice(
  gameShell.indexOf('<div className="relative min-w-0 flex-1 lg:hidden">'),
);
assert.doesNotMatch(mobileGameShell, /placement="game-/);

for (const file of roundResultFiles) {
  const source = read(file);
  assert.equal(count(source, 'placement="round-results"'), 1, file);
}

for (const file of gameScreenFiles) {
  const source = read(file);
  assert.match(source, /layoutMode: showFinalMatchResults/, file);
  assert.match(source, /activeView\.gamePhase === 'round-results'/, file);
}

const finalResults = read('plugins/bara-al-salafa/match-results-screen.tsx');
assert.equal(count(finalResults, 'placement="final-results-'), 3);
assert.match(finalResults, /final-results-left-desktop/);
assert.match(finalResults, /final-results-right-desktop/);
assert.match(finalResults, /placement="final-results-mobile"[\s\S]*?xl:hidden/);

const placementSources = [
  placeholder,
  home,
  lobby,
  gameShell,
  finalResults,
  ...roundResultFiles.map(read),
  ...gameScreenFiles.map(read),
].join('\n');
assert.doesNotMatch(placementSources, /adsbygoogle|data-ad-slot|ca-pub|pub-\d/);

console.log('Ad placeholder layout contract passed');
