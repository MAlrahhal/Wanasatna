import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

const placeholder = read('components/ads/ad-placeholder.tsx');
assert.match(placeholder, /process\.env\.NODE_ENV === 'production'[\s\S]*return null/);
assert.match(placeholder, /data-ad-placement=\{placement\}/);
assert.doesNotMatch(placeholder, /onClick|<script|adsbygoogle|data-ad-slot|ca-pub|pub-\d/);

const home = read('app/(public)/home-page-client.tsx');
assert.match(home, /<AdPlacement placement="home-hero"/);
assert.match(home, /<AdPlacement placement="home-room-actions"/);
assert.match(home, /placement="home-featured-games-near-end"/);
assert.ok(home.indexOf('home-hero') > home.indexOf('PublicBrandLogo'));
assert.ok(home.indexOf('home-room-actions') > home.indexOf('<RoomActionCards'));
assert.ok(home.indexOf('home-featured-games-near-end') > home.indexOf('featuredGames.map'));

const lobby = read('components/lobby/lobby-screen.tsx');
assert.match(lobby, /placement="lobby-players"[\s\S]*?viewport="compact"/);
assert.match(lobby, /placement="lobby-chat"[\s\S]*?viewport="wide"/);
assert.ok(lobby.indexOf('placement="lobby-players"') > lobby.indexOf('PlayersPanel'));
assert.ok(lobby.indexOf('placement="lobby-chat"') > lobby.indexOf('grid min-w-0'));
assert.doesNotMatch(lobby, /AdsterraBanner/);

const gameShell = read('components/game-experience/game-experience-shell.tsx');
assert.match(gameShell, /meta\.layoutMode === 'gameplay'/);
assert.match(gameShell, /meta\.layoutMode === 'round-results'/);
assert.match(gameShell, /placement="game-chat"/);
assert.match(gameShell, /placement="game-leaderboard"/);
assert.doesNotMatch(gameShell, /AdPlaceholder/);

for (const file of [
  'plugins/fast-answer/question-screen.tsx',
  'plugins/who-wrote-it/answering-screen.tsx',
  'plugins/judge/answering-screen.tsx',
]) {
  const source = read(file);
  assert.match(
    source,
    /<form[\s\S]*?<\/form>[\s\S]*?<AdPlacement placement="game-answer-input"/,
    file,
  );
}

const productionPlacementSources = [
  read('components/ads/ad-placement.tsx'),
  read('components/ads/adsterra-banner.tsx'),
].join('\n');
assert.doesNotMatch(
  productionPlacementSources,
  /fixed|sticky|adsbygoogle|data-ad-slot|ca-pub|pub-\d/,
);
assert.doesNotMatch(read('app/layout.tsx'), /highrevenueformat|AdsterraBanner|AdPlacement/);

console.log('Production ad placement layout contract passed');
