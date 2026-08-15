/**
 * P7-B shared audio engine + header control contracts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

class MemoryStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
}

class FakeAudio {
  static instances: FakeAudio[] = [];
  src = '';
  volume = 1;
  muted = false;
  paused = true;
  currentTime = 0;
  preload = 'auto';
  playCalls = 0;
  rejectPlay = false;
  onended: (() => void) | null = null;

  constructor() {
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    this.playCalls += 1;
    if (this.rejectPlay) {
      return Promise.reject(new Error('blocked'));
    }
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }
}

const localStorage = new MemoryStorage();
let hidden = false;

Object.assign(globalThis, {
  window: globalThis,
  localStorage,
  document: {
    get hidden() {
      return hidden;
    },
    addEventListener(): void {},
    removeEventListener(): void {},
  },
  Audio: FakeAudio,
});

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function playCount(): number {
  return FakeAudio.instances.reduce((sum, node) => sum + node.playCalls, 0);
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

void (async () => {
  const audio = await import('../lib/game/sounds');

  function setup(): void {
    FakeAudio.instances = [];
    hidden = false;
    localStorage.clear();
    audio.resetGameAudioForTests();
  }

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    try {
      await fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  await test('defaults are unmuted', () => {
    setup();
    assert.deepEqual(audio.getGameAudioPreferences(), { muted: false });
  });

  await test('save/load mute preference and ignore leftover volume', () => {
    setup();
    audio.setGameAudioMuted(true);
    assert.equal(localStorage.getItem('wanasatna:audio-prefs'), '{"muted":true}');
    audio.resetGameAudioForTests();
    assert.deepEqual(audio.getGameAudioPreferences(), { muted: true });
    localStorage.setItem('wanasatna:audio-prefs', '{"muted":false,"volume":0.25}');
    audio.resetGameAudioForTests();
    assert.deepEqual(audio.getGameAudioPreferences(), { muted: false });
    audio.setGameAudioMuted(false);
    assert.equal(localStorage.getItem('wanasatna:audio-prefs'), '{"muted":false}');
  });

  await test('malformed JSON falls back to defaults', () => {
    setup();
    localStorage.setItem('wanasatna:audio-prefs', '{not-json');
    audio.resetGameAudioForTests();
    assert.deepEqual(audio.getGameAudioPreferences(), { muted: false });
  });

  await test('locked until unlock; unlock is idempotent and silent', async () => {
    setup();
    audio.playGameSound('go');
    assert.equal(FakeAudio.instances.length, 0);
    audio.unlockGameAudio();
    audio.unlockGameAudio();
    await flush();
    assert.ok(FakeAudio.instances.length >= 1);
    assert.equal(playCount(), 1);
    assert.equal(FakeAudio.instances[0]?.muted, false);
  });

  await test('muted prevents playback and stopAll resets nodes', async () => {
    setup();
    audio.unlockGameAudio();
    await flush();
    audio.setGameAudioMuted(true);
    const before = playCount();
    audio.playGameSound('go');
    assert.equal(playCount(), before);
    audio.stopAllGameSounds();
    assert.ok(FakeAudio.instances.every((node) => node.paused));
    assert.ok(FakeAudio.instances.every((node) => node.currentTime === 0));
    assert.equal(localStorage.getItem('wanasatna:audio-prefs')?.includes('"muted":true'), true);
  });

  await test('unmuted master volume is 1.0; per-sound gain still applies', async () => {
    setup();
    audio.unlockGameAudio();
    await flush();
    audio.playGameSound('go');
    const startNode = FakeAudio.instances.find((item) => !item.paused) ?? FakeAudio.instances.at(-1);
    assert.ok(startNode);
    assert.equal(startNode.volume, 0.78);
  });

  await test('same eventKey plays once; different eventKey allowed after throttle', async () => {
    setup();
    audio.unlockGameAudio();
    await flush();
    const before = playCount();
    audio.playGameSound('go', { eventKey: 'turn:1' });
    audio.playGameSound('go', { eventKey: 'turn:1' });
    await delay(130);
    audio.playGameSound('go', { eventKey: 'turn:1' });
    audio.playGameSound('go', { eventKey: 'turn:2' });
    assert.equal(playCount() - before, 2);
  });

  await test('same-sound throttle blocks stacked plays', async () => {
    setup();
    audio.unlockGameAudio();
    await flush();
    const before = playCount();
    audio.playGameSound('go');
    audio.playGameSound('go');
    assert.equal(playCount() - before, 1);
  });

  await test('hidden document suppresses new playback', async () => {
    setup();
    audio.unlockGameAudio();
    await flush();
    hidden = true;
    const before = playCount();
    audio.playGameSound('go');
    assert.equal(playCount(), before);
  });

  await test('playback rejection does not throw', async () => {
    setup();
    audio.unlockGameAudio();
    await flush();
    FakeAudio.instances.forEach((node) => {
      node.rejectPlay = true;
    });
    assert.doesNotThrow(() => audio.playGameSound('go', { eventKey: 'x' }));
    await flush();
  });

  await test('card-request ping uses the shared engine', async () => {
    setup();
    audio.unlockGameAudio();
    await flush();
    const before = playCount();
    audio.playSoftCardRequestPing();
    assert.equal(playCount() - before, 1);
    const pingNode = FakeAudio.instances.find((node) => Math.abs(node.volume - 0.48) < 0.001);
    assert.ok(pingNode);
  });

  await test('max two concurrent SFX', async () => {
    setup();
    audio.unlockGameAudio();
    await flush();
    audio.playGameSound('go', { eventKey: 'a' });
    audio.playGameSound('your-turn', { eventKey: 'b' });
    const before = playCount();
    audio.playGameSound('notify', { eventKey: 'extra' });
    assert.equal(playCount(), before);
  });

  await test('engine has a reusable HTMLAudioElement pool and no oscillator', () => {
    const sounds = read('lib/game/sounds.ts');
    assert.match(sounds, /POOL_SIZE = 3/);
    assert.match(sounds, /MAX_CONCURRENT = 2/);
    assert.match(sounds, /SAME_SOUND_THROTTLE_MS = 120/);
    assert.match(sounds, /MASTER_VOLUME = 1/);
    assert.match(sounds, /wanasatna:audio-prefs/);
    assert.doesNotMatch(sounds, /AudioContext/);
    assert.doesNotMatch(sounds, /createOscillator/);
    assert.match(sounds, /eventKey/);
    assert.match(sounds, /\/audio\/sfx\/go\.wav/);
  });

  await test('Lobby and Game Experience headers expose compact audio control', () => {
    const lobby = read('components/lobby/lobby-header.tsx');
    const game = read('components/game-experience/game-experience-header.tsx');
    const control = read('components/game/game-audio-control.tsx');
    const sounds = read('lib/game/sounds.ts');
    const shell = read('components/game-experience/game-experience-shell.tsx');
    const layout = read('app/(room)/layout.tsx');
    assert.match(lobby, /<GameAudioControl/);
    assert.match(game, /<GameAudioControl/);
    assert.match(game, /flex flex-col gap-1\.5 md:hidden/);
    assert.match(control, /aria-label=\{prefs\.muted \? 'الصوت مكتوم' : 'الصوت'\}/);
    assert.match(control, /aria-pressed=\{prefs\.muted\}/);
    assert.match(control, /size-11 min-h-11 min-w-11/);
    assert.match(control, /setGameAudioMuted\(!prefs\.muted\)/);
    assert.doesNotMatch(control, /game-audio-volume|game-audio-panel|مستوى الصوت|setGameAudioVolume/);
    assert.doesNotMatch(sounds, /setGameAudioVolume/);
    assert.doesNotMatch(control, /🎵|🔊|🔇/);
    assert.match(shell, /stopAllGameSounds/);
    assert.match(shell, /clearGameAudioEventKeys/);
    assert.match(layout, /<GameAudioSession/);
  });

  await test('existing Timing and GC audio call sites are preserved', () => {
    const timing = read('plugins/timing-challenge/use-timing-start-sound.ts');
    const ready = read('plugins/timing-challenge/ready-screen.tsx');
    const stop = read('plugins/timing-challenge/stop-timer-screen.tsx');
    const panel = read('plugins/guessing-challenge/special-cards-panel.tsx');
    assert.match(timing, /playGameSound\('go'/);
    assert.match(timing, /if \(!prev\)/);
    assert.match(ready, /unlockGameAudio\(\)/);
    assert.match(stop, /unlockGameAudio\(\)/);
    assert.match(panel, /playSoftCardRequestPing\(/);
    assert.match(panel, /lastPingKey/);
    assert.doesNotMatch(timing, /countdown-tick|time-up|your-turn/);
  });

  await test('P7-B does not wire the P7-C gameplay sound map', () => {
    const playing = read('plugins/guessing-challenge/playing-screen.tsx');
    const countdown = read('plugins/bara-al-salafa/countdown-screen.tsx');
    assert.doesNotMatch(playing, /playGameSound\('your-turn'/);
    assert.doesNotMatch(playing, /playGameSound\('correct'/);
    assert.doesNotMatch(countdown, /playGameSound/);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
