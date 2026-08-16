/**
 * P11-B.2: GameScreen chunk retry + Guessing Challenge Real3D import fallback.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import '@/plugins';
import { getClientGamePlugin, listClientGamePlugins } from '@/lib/game-plugins/registry';
import { reloadStaleGameChunk } from '@/lib/game-plugins/reload-stale-game-chunk';
import { presentRoomActionError, SYSTEM_COPY } from '@/lib/ui/system-copy';
import { ROOM_SESSION_STORAGE_KEYS } from '@/lib/room/session';
import { ACTIVE_ROOM_SESSION_KEY } from '@/lib/room-v2/types';
import { RECONNECT_CLAIMS_STORAGE_KEY } from '@/lib/room-v2/reconnect-claims';
import { ACTIVE_ROOM_RESUME_STORAGE_KEY } from '@/lib/room/reconnect-credential';
import { shouldUseCssGameplayFallback } from '@/plugins/guessing-challenge/scene-props';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const GAMES = [
  'bara-al-salafa',
  'draw-guess',
  'imposter-draw',
  'timing-challenge',
  'fast-answer',
  'who-wrote-it',
  'judge',
  'guessing-challenge',
] as const;

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

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  clear(): void {
    this.store.clear();
  }
}

test('1. lazy GameScreen loading UI remains', () => {
  const lazy = read('lib/game-plugins/lazy-game-screen.tsx');
  assert.match(lazy, /loading: GameScreenChunkLoading/);
  assert.match(lazy, /GameSystemLoading/);
  assert.match(lazy, /ssr:\s*false/);
});

test('2-4. GameScreen import failure shows safe error with reload Retry', () => {
  const lazy = read('lib/game-plugins/lazy-game-screen.tsx');
  const roomState = read('components/room/room-system-state.tsx');
  const presented = presentRoomActionError(SYSTEM_COPY.gameLoadFailed);

  assert.match(lazy, /GameScreenChunkErrorBoundary/);
  assert.match(lazy, /SYSTEM_COPY\.gameLoadFailed/);
  assert.match(lazy, /onRetry=\{reloadStaleGameChunk\}/);
  assert.match(roomState, /onRetry/);
  assert.match(roomState, /SYSTEM_COPY\.retry/);
  assert.equal(presented.title, 'تعذر تحميل اللعبة.');
  assert.equal(presented.description, 'تحقق من اتصالك وحاول مرة ثانية.');
  assert.equal(SYSTEM_COPY.retry, 'إعادة المحاولة');
  assert.doesNotMatch(presented.title + (presented.description ?? ''), /chunk|webpack|turbopack|dynamic import/i);

  const reload = read('lib/game-plugins/reload-stale-game-chunk.ts');
  assert.match(reload, /location\.reload/);
  assert.doesNotMatch(reload, /leaveRoom|clearLocalParticipation|removeReconnectClaim|clearRoomSession/);
});

test('5. Retry reload does not clear Room identity or reconnect claim', () => {
  const session = new MemoryStorage();
  const local = new MemoryStorage();
  session.setItem(ROOM_SESSION_STORAGE_KEYS.playerId, 'p1');
  session.setItem(ROOM_SESSION_STORAGE_KEYS.roomId, 'room-1');
  session.setItem(ROOM_SESSION_STORAGE_KEYS.playerName, 'أحمد');
  session.setItem(ROOM_SESSION_STORAGE_KEYS.roomCode, '482910');
  session.setItem(
    ACTIVE_ROOM_SESSION_KEY,
    JSON.stringify({
      roomId: 'room-1',
      roomCode: '482910',
      playerId: 'p1',
      playerName: 'أحمد',
      reconnectToken: 'token-keep',
    }),
  );
  session.setItem(
    ACTIVE_ROOM_RESUME_STORAGE_KEY,
    JSON.stringify({
      playerId: 'p1',
      roomId: 'room-1',
      roomCode: '482910',
      reconnectToken: 'token-keep',
    }),
  );
  local.setItem(RECONNECT_CLAIMS_STORAGE_KEY, JSON.stringify({ keep: true }));

  const host = globalThis as unknown as {
    sessionStorage: MemoryStorage;
    localStorage: MemoryStorage;
    location: { reload: () => void };
  };
  host.sessionStorage = session;
  host.localStorage = local;
  let reloads = 0;
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: {
      reload: () => {
        reloads += 1;
      },
    },
  });

  reloadStaleGameChunk();

  assert.equal(reloads, 1);
  assert.equal(session.getItem(ROOM_SESSION_STORAGE_KEYS.playerId), 'p1');
  assert.equal(session.getItem(ROOM_SESSION_STORAGE_KEYS.roomCode), '482910');
  assert.match(session.getItem(ACTIVE_ROOM_SESSION_KEY) ?? '', /token-keep/);
  assert.match(session.getItem(ACTIVE_ROOM_RESUME_STORAGE_KEY) ?? '', /token-keep/);
  assert.equal(local.getItem(RECONNECT_CLAIMS_STORAGE_KEY), JSON.stringify({ keep: true }));
});

test('6. no automatic GameScreen chunk retry loop', () => {
  const lazy = read('lib/game-plugins/lazy-game-screen.tsx');
  const reload = read('lib/game-plugins/reload-stale-game-chunk.ts');
  assert.doesNotMatch(lazy, /setInterval/);
  assert.doesNotMatch(lazy, /componentDidCatch/);
  assert.doesNotMatch(reload, /setInterval|setTimeout/);
});

test('7. all 8 lazy registry entries still resolve and inherit retry', () => {
  const ids = listClientGamePlugins().map((plugin) => plugin.metadata.id).sort();
  assert.deepEqual(ids, [...GAMES].sort());

  const renderer = read('components/game-plugins/game-plugin-renderer.tsx');
  assert.match(renderer, /GameScreenChunkErrorBoundary key=\{gameId\}/);

  for (const id of GAMES) {
    const plugin = getClientGamePlugin(id);
    assert.ok(plugin, `${id} must resolve`);
    assert.equal(typeof plugin.GameScreen, 'function');
    const index = read(`plugins/${id}/index.tsx`);
    assert.match(index, /lazyGameScreen/);
  }
});

test('C. stale chunk after deploy recovers via reload + existing Room resume', () => {
  const lazy = read('lib/game-plugins/lazy-game-screen.tsx');
  const reload = read('lib/game-plugins/reload-stale-game-chunk.ts');
  const recovery = read('lib/game-shell/null-shell-recovery.ts');
  assert.match(lazy, /onRetry=\{reloadStaleGameChunk\}/);
  assert.match(reload, /location\.reload/);
  assert.match(recovery, /status: 'empty'/);
  assert.match(recovery, /buildLobbyUrl/);
});

test('9. WebGL unavailable uses CSS fallback', () => {
  assert.equal(shouldUseCssGameplayFallback({ webglSupported: false }), true);
  assert.equal(shouldUseCssGameplayFallback({ webglSupported: true }), false);
  const gameplay = read('plugins/guessing-challenge/gameplay-scene.tsx');
  assert.match(gameplay, /detectWebGLSupport\(\) \? 'real3d' : 'fallback'/);
  assert.match(gameplay, /CssGameplayFallback \{\.\.\.props\}/);
});

test('10. Real3D import loading copy remains until the chunk settles', () => {
  const gameplay = read('plugins/guessing-challenge/gameplay-scene.tsx');
  assert.match(gameplay, /gc-real3d-loading/);
  assert.match(gameplay, /جاري تحميل المشهد ثلاثي الأبعاد/);
});

test('11-13. Real3D import and runtime failures use CSS and do not kill GameScreen', () => {
  assert.equal(
    shouldUseCssGameplayFallback({ webglSupported: true, real3dImportFailed: true }),
    true,
  );
  assert.equal(
    shouldUseCssGameplayFallback({ webglSupported: true, real3dRuntimeFailed: true }),
    true,
  );

  const gameplay = read('plugins/guessing-challenge/gameplay-scene.tsx');
  const real3d = read('plugins/guessing-challenge/real3d/real3d-scene.tsx');
  const fallback = read('plugins/guessing-challenge/scene-fallback.tsx');
  const gameScreen = read('plugins/guessing-challenge/game-screen.tsx');

  assert.match(gameplay, /SceneFallbackBoundary/);
  assert.match(gameplay, /Real3DSceneLazy \{\.\.\.props\}/);
  assert.match(real3d, /SceneFallbackBoundary/);
  assert.match(real3d, /Real3DSceneInner \{\.\.\.props\}/);
  assert.match(fallback, /hasError/);
  assert.match(fallback, /FirstPersonGameScene \{\.\.\.props\}/);
  assert.doesNotMatch(gameplay, /GameSystemError/);
  assert.doesNotMatch(gameplay, /GameScreenChunkErrorBoundary/);
  assert.doesNotMatch(real3d, /GameSystemError/);
  assert.doesNotMatch(gameScreen, /real3d\/real3d-scene/);
});

test('14-15. CSS fallback keeps gameplay props and stays the interactive scene', () => {
  const fallback = read('plugins/guessing-challenge/scene-fallback.tsx');
  const scene = read('plugins/guessing-challenge/first-person-game-scene.tsx');
  const playing = read('plugins/guessing-challenge/playing-screen.tsx');
  assert.match(fallback, /FirstPersonGameScene \{\.\.\.props\}/);
  assert.match(scene, /data-testid="gc-first-person-scene"/);
  assert.match(scene, /matchMode/);
  assert.match(scene, /opponents/);
  assert.match(scene, /onUseYellow/);
  assert.match(scene, /onUseRed/);
  assert.match(playing, /GameplayScene/);
  assert.match(playing, /matchMode=\{view\.mode\}/);
  assert.match(playing, /selfSeat=\{view\.selfSeat/);
  assert.match(playing, /onLookChange=\{onLookChange\}/);
});

test('16-17. failed Real3D import is not retried every render; remount/refresh may try again', () => {
  const gameplay = read('plugins/guessing-challenge/gameplay-scene.tsx');
  const fallback = read('plugins/guessing-challenge/scene-fallback.tsx');
  assert.doesNotMatch(gameplay, /setInterval/);
  assert.doesNotMatch(fallback, /setInterval|location\.reload/);
  assert.match(fallback, /hasError: false/);
  assert.match(gameplay, /useEffect\(\(\) => \{[\s\S]*detectWebGLSupport\(\)[\s\S]*\}, \[\]\)/);
});

test('1v1 / 2v2 / look wiring is unchanged at the GameplayScene boundary', () => {
  const playing = read('plugins/guessing-challenge/playing-screen.tsx');
  assert.match(playing, /matchMode=\{view\.mode\}/);
  assert.match(playing, /teammate=\{mappedTeammate\}/);
  assert.match(playing, /opponents=\{mappedOpponents\}/);
  assert.match(playing, /onLookChange=\{onLookChange\}/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
