import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADSTERRA_BANNER_300x250, toAdsterraAtOptions } from '../lib/ads/adsterra';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

const config = read('lib/ads/adsterra.ts');
const component = read('components/ads/adsterra-banner.tsx');
const lobby = read('components/lobby/lobby-screen.tsx');

assert.equal(ADSTERRA_BANNER_300x250.key, 'def2570bbac8dbcccbff340a7eff4565');
assert.equal(ADSTERRA_BANNER_300x250.format, 'iframe');
assert.equal(ADSTERRA_BANNER_300x250.height, 250);
assert.equal(ADSTERRA_BANNER_300x250.width, 300);
assert.deepEqual(ADSTERRA_BANNER_300x250.params, {});
assert.equal(
  ADSTERRA_BANNER_300x250.invokeSrc,
  'https://www.highrevenueformat.com/def2570bbac8dbcccbff340a7eff4565/invoke.js',
);
assert.deepEqual(toAdsterraAtOptions(ADSTERRA_BANNER_300x250), {
  key: 'def2570bbac8dbcccbff340a7eff4565',
  format: 'iframe',
  height: 250,
  width: 300,
  params: {},
});

assert.match(config, /'def2570bbac8dbcccbff340a7eff4565'/);
assert.match(
  config,
  /https:\/\/www\.highrevenueformat\.com\/def2570bbac8dbcccbff340a7eff4565\/invoke\.js/,
);
assert.doesNotMatch(config, /popunder|social bar|direct link|push notification/i);

assert.match(component, /'use client'/);
assert.match(component, /useEffect/);
assert.match(component, /script\.async = false/);
assert.match(component, /style=\{\{ width: zone\.width, height: zone\.height \}\}/);
assert.match(component, /overflow-x-auto/);
assert.match(component, /clearNode\(host\)/);
assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
assert.doesNotMatch(component, /position:\s*['"]fixed['"]|fixed inset/);

assert.match(lobby, /<AdsterraBanner className="mt-1" \/>/);
assert.ok(lobby.indexOf('<AdsterraBanner') > lobby.indexOf('PlayersPanel'));
assert.ok(lobby.indexOf('<AdsterraBanner') > lobby.indexOf('LobbyChat'));
assert.ok(lobby.indexOf('<AdsterraBanner') < lobby.indexOf('placement="lobby-mobile"'));
const chatSheet = lobby.slice(
  lobby.indexOf('mobile-room-chat-sheet'),
  lobby.indexOf('placement="lobby-chat-desktop"'),
);
assert.doesNotMatch(chatSheet, /AdsterraBanner/);

const gameExperience = read('components/game-experience/game-experience-shell.tsx');
assert.doesNotMatch(gameExperience, /AdsterraBanner/);
assert.doesNotMatch(read('app/layout.tsx'), /highrevenueformat|AdsterraBanner/);

console.log('Adsterra banner contract passed');
