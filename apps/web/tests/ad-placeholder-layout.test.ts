import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8');

const home = read('app/(public)/home-page-client.tsx');
assert.equal(home.match(/unit="home-native"/g)?.length, 1);
assert.ok(home.indexOf('unit="home-native"') > home.indexOf('<RoomActionCards'));
assert.ok(home.indexOf('unit="home-native"') < home.indexOf('data-home-featured-games-section'));
assert.doesNotMatch(home, /placement="home-|featuredGamesBeforeNearEndAd|finalFeaturedGame/);

const lobby = read('components/lobby/lobby-screen.tsx');
assert.equal(lobby.match(/unit="lobby-native"/g)?.length, 1);
assert.equal(lobby.match(/placement="lobby-side-rail"/g)?.length, 1);
assert.equal(lobby.match(/placement="lobby-players-rectangle"/g)?.length, 1);
assert.match(lobby, /xl:grid-cols-\[300px_/);
assert.doesNotMatch(lobby, /2xl:grid-cols-\[[^\]]*_160px\]/);
assert.match(
  lobby,
  /<LobbyChat[\s\S]*data-lobby-ad-association="side-rail"[\s\S]*placement="lobby-side-rail"/,
);
assert.match(lobby, /<PlayersPanel[\s\S]*placement="lobby-players-rectangle"/);
assert.ok(lobby.indexOf('unit="lobby-native"') > lobby.indexOf('<PlayersPanel'));
assert.ok(lobby.indexOf('unit="lobby-native"') > lobby.indexOf('<LobbyChat'));
assert.doesNotMatch(lobby, /placement="lobby-(?:players|chat)"|data-lobby-ad-rows/);

const staticPlacement = read('components/ads/ad-placement.tsx');
const staticBanner = read('components/ads/adsterra-banner.tsx');
const nativePlacement = read('components/ads/native-ad-placement.tsx');
for (const source of [staticPlacement, staticBanner, nativePlacement]) {
  assert.doesNotMatch(source, /fixed|sticky|absolute|100dvw|w-screen|scale/);
}
assert.match(staticPlacement, /w-full/);
assert.match(staticBanner, /justify-center/);
assert.match(nativePlacement, /w-full min-w-0 overflow-hidden/);
assert.doesNotMatch(read('app/layout.tsx'), /highrevenueformat|AdsterraBanner|AdPlacement/);

console.log('Production ad placement layout contract passed');
