import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AD_PLACEMENTS,
  ADSTERRA_BANNER_300x250,
  ADSTERRA_BANNER_DESKTOP_728x90,
  ADSTERRA_BANNER_MOBILE_320x50,
  isAdPlacementVisibleAtViewport,
  selectResponsiveAdsterraZone,
  toAdsterraAtOptions,
} from '../lib/ads/adsterra';
import { createSerialTaskQueue } from '../lib/ads/adsterra-loader';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

async function verifySerializedLoads(): Promise<void> {
  const queue = createSerialTaskQueue();
  const events: string[] = [];

  const first = queue.enqueue(async () => {
    events.push('first:start');
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    events.push('first:end');
  });
  const second = queue.enqueue(async () => {
    events.push('second:start');
    events.push('second:end');
  });

  await Promise.all([first, second]);
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
}

async function main(): Promise<void> {
  assert.deepEqual(ADSTERRA_BANNER_DESKTOP_728x90, {
    key: '8c7899da0472ebe9381fa1297c9ea859',
    format: 'iframe',
    height: 90,
    width: 728,
    params: {},
    invokeSrc: 'https://www.highrevenueformat.com/8c7899da0472ebe9381fa1297c9ea859/invoke.js',
  });
  assert.deepEqual(ADSTERRA_BANNER_MOBILE_320x50, {
    key: '8ab90065c8e99084fa144b118690d7ef',
    format: 'iframe',
    height: 50,
    width: 320,
    params: {},
    invokeSrc: 'https://www.highrevenueformat.com/8ab90065c8e99084fa144b118690d7ef/invoke.js',
  });
  assert.deepEqual(toAdsterraAtOptions(ADSTERRA_BANNER_DESKTOP_728x90), {
    key: '8c7899da0472ebe9381fa1297c9ea859',
    format: 'iframe',
    height: 90,
    width: 728,
    params: {},
  });
  assert.equal(selectResponsiveAdsterraZone(319), null);
  assert.equal(selectResponsiveAdsterraZone(799), ADSTERRA_BANNER_MOBILE_320x50);
  assert.equal(selectResponsiveAdsterraZone(800), ADSTERRA_BANNER_DESKTOP_728x90);
  assert.equal(isAdPlacementVisibleAtViewport(390, 'compact'), true);
  assert.equal(isAdPlacementVisibleAtViewport(1280, 'compact'), false);
  assert.equal(isAdPlacementVisibleAtViewport(1280, 'wide'), true);
  assert.deepEqual(Object.keys(AD_PLACEMENTS), [
    'home-hero',
    'home-room-actions',
    'lobby-players',
    'lobby-chat',
    'game-chat',
    'game-leaderboard',
    'game-answer-input',
    'home-featured-games-near-end',
  ]);
  assert.equal(ADSTERRA_BANNER_300x250.width, 300, 'legacy zone remains available but unused');

  await verifySerializedLoads();

  const config = read('lib/ads/adsterra.ts');
  const loader = read('lib/ads/adsterra-loader.ts');
  const component = read('components/ads/adsterra-banner.tsx');
  const placement = read('components/ads/ad-placement.tsx');
  const home = read('app/(public)/home-page-client.tsx');
  const lobby = read('components/lobby/lobby-screen.tsx');
  const gameExperience = read('components/game-experience/game-experience-shell.tsx');

  assert.match(config, /8c7899da0472ebe9381fa1297c9ea859/);
  assert.match(config, /8ab90065c8e99084fa144b118690d7ef/);
  assert.match(loader, /adsterraScriptQueue\.enqueue/);
  assert.match(loader, /adWindow\.atOptions = options/);
  assert.match(loader, /delete adWindow\.atOptions/);
  assert.match(component, /enqueueAdsterraBanner/);
  assert.doesNotMatch(component, /document\.createElement\('script'\)/);
  assert.match(placement, /selectResponsiveAdsterraZone\(viewportWidth\)/);
  assert.doesNotMatch(placement, /fixed|sticky|z-/);
  assert.match(placement, /w-screen max-w-\[100vw\]/);

  assert.match(home, /placement="home-hero"/);
  assert.match(home, /placement="home-room-actions"/);
  assert.match(home, /placement="home-featured-games-near-end"/);
  assert.ok(home.indexOf('home-room-actions') > home.indexOf('<RoomActionCards'));
  assert.ok(home.indexOf('home-featured-games-near-end') > home.indexOf('featuredGames.map'));

  assert.match(lobby, /placement="lobby-players"/);
  assert.match(lobby, /placement="lobby-chat"/);
  assert.doesNotMatch(lobby, /AdsterraBanner|ADSTERRA_BANNER_300x250/);
  assert.ok(lobby.indexOf('placement="lobby-players"') > lobby.indexOf('PlayersPanel'));
  assert.ok(lobby.indexOf('placement="lobby-chat"') > lobby.indexOf('grid min-w-0'));

  assert.match(gameExperience, /placement="game-chat"/);
  assert.match(gameExperience, /placement="game-leaderboard"/);
  assert.doesNotMatch(gameExperience, /AdPlaceholder/);
  assert.doesNotMatch(read('app/layout.tsx'), /highrevenueformat|AdsterraBanner|AdPlacement/);
  assert.doesNotMatch(read('plugins/fast-answer/game-screen.tsx'), /AdPlacement/);
  assert.doesNotMatch(read('plugins/who-wrote-it/game-screen.tsx'), /AdPlacement/);
  assert.doesNotMatch(read('plugins/judge/game-screen.tsx'), /AdPlacement/);
  assert.match(read('plugins/fast-answer/question-screen.tsx'), /placement="game-answer-input"/);
  assert.match(read('plugins/who-wrote-it/answering-screen.tsx'), /placement="game-answer-input"/);
  assert.match(read('plugins/judge/answering-screen.tsx'), /placement="game-answer-input"/);

  console.log('Adsterra production banner contract passed');
}

void main();
