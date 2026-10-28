import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADSTERRA_BANNER_160x300,
  ADSTERRA_BANNER_160x600,
  ADSTERRA_BANNER_300x250,
  ADSTERRA_BANNER_468x60,
  ADSTERRA_BANNER_DESKTOP_728x90,
  ADSTERRA_BANNER_MOBILE_320x50,
  ADSTERRA_STATIC_ZONES,
  STATIC_AD_PLACEMENTS,
  selectFittingStaticZone,
  toAdsterraAtOptions,
} from '../lib/ads/adsterra';
import { ADSTERRA_NATIVE_UNITS } from '../lib/ads/adsterra-native';
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
    events.push('second:start', 'second:end');
  });
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
}

async function main(): Promise<void> {
  assert.deepEqual(
    Object.values(ADSTERRA_STATIC_ZONES).map(
      ({ id, key, format, width, height, params, invokeSrc }) => ({
        id,
        key,
        format,
        width,
        height,
        params,
        invokeSrc,
      }),
    ),
    [
      {
        id: 'rectangle-300x250',
        key: 'def2570bbac8dbcccbff340a7eff4565',
        format: 'iframe',
        width: 300,
        height: 250,
        params: {},
        invokeSrc: 'https://bauval.org/22/def2570bbac8dbcccbff340a7eff4565',
      },
      {
        id: 'mobile-320x50',
        key: '8ab90065c8e99084fa144b118690d7ef',
        format: 'iframe',
        width: 320,
        height: 50,
        params: {},
        invokeSrc: 'https://bauval.org/22/8ab90065c8e99084fa144b118690d7ef',
      },
      {
        id: 'leaderboard-728x90',
        key: '8c7899da0472ebe9381fa1297c9ea859',
        format: 'iframe',
        width: 728,
        height: 90,
        params: {},
        invokeSrc: 'https://bauval.org/22/8c7899da0472ebe9381fa1297c9ea859',
      },
      {
        id: 'skyscraper-160x600',
        key: '863737c9637f7fa3bac6344d36097d8b',
        format: 'iframe',
        width: 160,
        height: 600,
        params: {},
        invokeSrc: 'https://bauval.org/22/863737c9637f7fa3bac6344d36097d8b',
      },
      {
        id: 'banner-468x60',
        key: 'eb85acaa87873198ac330afab579920e',
        format: 'iframe',
        width: 468,
        height: 60,
        params: {},
        invokeSrc: 'https://bauval.org/22/eb85acaa87873198ac330afab579920e',
      },
      {
        id: 'sidebar-160x300',
        key: '4614f03613a254f4dbc71d0546e42ccf',
        format: 'iframe',
        width: 160,
        height: 300,
        params: {},
        invokeSrc: 'https://bauval.org/22/4614f03613a254f4dbc71d0546e42ccf',
      },
    ],
  );
  assert.equal(Object.values(ADSTERRA_STATIC_ZONES).length, 6);
  assert.equal(new Set(Object.values(ADSTERRA_STATIC_ZONES).map((zone) => zone.key)).size, 6);
  assert.equal(
    Object.values(ADSTERRA_STATIC_ZONES).filter((zone) => zone.id === 'banner-468x60').length,
    1,
  );
  assert.deepEqual(toAdsterraAtOptions(ADSTERRA_BANNER_DESKTOP_728x90), {
    key: ADSTERRA_BANNER_DESKTOP_728x90.key,
    format: 'iframe',
    height: 90,
    width: 728,
    params: {},
  });

  assert.equal(selectFittingStaticZone('gameplay-primary', 319, 390), null);
  assert.equal(
    selectFittingStaticZone('gameplay-primary', 320, 799),
    ADSTERRA_BANNER_MOBILE_320x50,
  );
  assert.equal(selectFittingStaticZone('gameplay-primary', 727, 1280), ADSTERRA_BANNER_468x60);
  assert.equal(
    selectFittingStaticZone('gameplay-primary', 728, 1280),
    ADSTERRA_BANNER_DESKTOP_728x90,
  );
  assert.equal(
    selectFittingStaticZone('gameplay-primary', 1000, 799),
    ADSTERRA_BANNER_MOBILE_320x50,
  );
  assert.equal(selectFittingStaticZone('lobby-side-rail', 160, 1535), null);
  assert.equal(selectFittingStaticZone('lobby-side-rail', 160, 1536), ADSTERRA_BANNER_160x600);
  assert.equal(selectFittingStaticZone('gameplay-side-rail', 160, 1279), null);
  assert.equal(selectFittingStaticZone('gameplay-side-rail', 160, 1280), ADSTERRA_BANNER_160x300);
  assert.equal(selectFittingStaticZone('game-chat-rectangle', 299, 1440), null);
  assert.equal(selectFittingStaticZone('game-chat-rectangle', 300, 1440), ADSTERRA_BANNER_300x250);
  assert.equal(
    selectFittingStaticZone('lobby-players-rectangle', 300, 1440),
    ADSTERRA_BANNER_300x250,
  );
  assert.equal(
    selectFittingStaticZone('results-primary', 728, 1440),
    ADSTERRA_BANNER_DESKTOP_728x90,
  );
  assert.deepEqual(STATIC_AD_PLACEMENTS['gameplay-primary'], [
    'leaderboard-728x90',
    'banner-468x60',
    'mobile-320x50',
  ]);
  assert.equal(ADSTERRA_BANNER_300x250.width, 300);

  assert.deepEqual(ADSTERRA_NATIVE_UNITS, {
    'home-native': {
      id: 'home-native',
      invokeSrc: 'https://bauval.org/21/3dd3ec9a400fe77f9d05bdaef34d52f4',
      containerId: 'container-3dd3ec9a400fe77f9d05bdaef34d52f4',
    },
    'lobby-native': {
      id: 'lobby-native',
      invokeSrc: 'https://bauval.org/21/73dd4ecebe7efa0f366b1fc9060c7f22',
      containerId: 'container-73dd4ecebe7efa0f366b1fc9060c7f22',
    },
    'results-native': {
      id: 'results-native',
      invokeSrc: 'https://bauval.org/21/b2785198615471bba4ff6b7b78337072',
      containerId: 'container-b2785198615471bba4ff6b7b78337072',
    },
  });
  assert.equal(
    new Set([
      ...Object.values(ADSTERRA_STATIC_ZONES).map((zone) => zone.invokeSrc),
      ...Object.values(ADSTERRA_NATIVE_UNITS).map((unit) => unit.invokeSrc),
    ]).size,
    9,
  );

  await verifySerializedLoads();

  const loader = read('lib/ads/adsterra-loader.ts');
  const staticConfig = read('lib/ads/adsterra.ts');
  const nativeConfig = read('lib/ads/adsterra-native.ts');
  const placement = read('components/ads/ad-placement.tsx');
  const banner = read('components/ads/adsterra-banner.tsx');
  const nativeLoader = read('lib/ads/adsterra-native-loader.ts');
  const nativePlacement = read('components/ads/native-ad-placement.tsx');
  const resultsPlacement = read('components/ads/results-ad-placement.tsx');
  assert.match(loader, /queue\.enqueue/);
  assert.match(loader, /zoneOwners/);
  assert.match(loader, /adWindow\.atOptions = options/);
  assert.match(loader, /delete adWindow\.atOptions/);
  assert.match(loader, /hasRenderedAd/);
  assert.match(staticConfig, /NEXT_PUBLIC_ADSTERRA_ADS_ENABLED !== 'false'/);
  assert.match(staticConfig, /if \(!ADSTERRA_ADS_ENABLED/);
  assert.match(nativeConfig, /ADSTERRA_NATIVE_ADS_ENABLED = ADSTERRA_ADS_ENABLED/);
  assert.match(placement, /ResizeObserver/);
  assert.match(placement, /getBoundingClientRect\(\)\.width/);
  assert.match(placement, /selectFittingStaticZone/);
  assert.doesNotMatch(placement, /100dvw|w-screen|fixed|sticky|scale/);
  assert.match(
    banner,
    /outcome === 'error'[\s\S]*outcome === 'timeout'[\s\S]*outcome === 'duplicate'/,
  );
  assert.match(nativeLoader, /records = new Map/);
  assert.match(nativeLoader, /cleanupId/);
  assert.doesNotMatch(nativeLoader, /atOptions/);
  assert.match(nativePlacement, /enqueueAdsterraNative/);
  assert.match(nativePlacement, /if \(!host \|\| !ADSTERRA_NATIVE_ADS_ENABLED\)/);
  assert.match(nativePlacement, /fallbackAfterMs/);
  assert.doesNotMatch(nativePlacement, /fixed|sticky|absolute|scale/);
  assert.match(resultsPlacement, /unit="results-native"/);
  assert.match(resultsPlacement, /fallbackAfterMs=\{RESULTS_NATIVE_FALLBACK_MS\}/);
  assert.match(resultsPlacement, /placement="results-primary"/);

  const productionPlacementSources = [
    read('app/(public)/home-page-client.tsx'),
    read('components/lobby/lobby-screen.tsx'),
    read('components/game-experience/game-experience-shell.tsx'),
    read('plugins/fast-answer/question-screen.tsx'),
  ].join('\n');
  assert.match(productionPlacementSources, /placement="game-chat-rectangle"/);
  assert.match(productionPlacementSources, /placement="lobby-players-rectangle"/);
  assert.doesNotMatch(
    read('app/layout.tsx'),
    /highrevenueformat|profitableratecpmnetwork|bauval\.org|AdsterraBanner|AdPlacement/,
  );

  console.log('Adsterra inventory and responsive selection contract passed');
}

void main();
