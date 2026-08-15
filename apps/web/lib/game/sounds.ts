/**
 * Shared SFX engine. Temporary cue: /public/sounds/timer-start.wav (unlicensed; P7-D replaces).
 */

export type GameSoundId = 'timer-start' | 'card-request';

export type GameAudioPreferences = {
  muted: boolean;
  volume: number;
};

export type PlayGameSoundOptions = {
  eventKey?: string;
};

const PREFS_KEY = 'wanasatna:audio-prefs';
const DEFAULT_PREFS: GameAudioPreferences = { muted: false, volume: 0.6 };
const POOL_SIZE = 3;
const MAX_CONCURRENT = 2;
const SAME_SOUND_THROTTLE_MS = 120;
const EVENT_KEY_LIMIT = 256;

// Map only files that exist. P7-C can add: countdown-tick, go, your-turn, correct, wrong, time-up, round-result, match-win, notify.
const SOUND_SRC: Partial<Record<GameSoundId, string>> = {
  'timer-start': '/sounds/timer-start.wav',
  'card-request': '/sounds/timer-start.wav',
};


const SOUND_GAIN: Partial<Record<GameSoundId, number>> = {
  'card-request': 0.35,
};

type PoolNode = {
  el: HTMLAudioElement;
  busy: boolean;
  gain: number;
};

let unlocked = false;
let unlocking = false;
let prefs: GameAudioPreferences = { ...DEFAULT_PREFS };
let prefsSnapshot: GameAudioPreferences = { ...DEFAULT_PREFS };
let prefsLoaded = false;
let pool: PoolNode[] | null = null;
let activeCount = 0;
const eventKeys = new Set<string>();
const lastPlayedAt = new Map<string, number>();
const listeners = new Set<(prefs: GameAudioPreferences) => void>();

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PREFS.volume;
  }
  return Math.min(1, Math.max(0, value));
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readStoredPrefs(): GameAudioPreferences {
  if (!isBrowser()) {
    return { ...DEFAULT_PREFS };
  }
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) {
      return { ...DEFAULT_PREFS };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_PREFS };
    }
    const record = parsed as { muted?: unknown; volume?: unknown };
    return {
      muted: typeof record.muted === 'boolean' ? record.muted : DEFAULT_PREFS.muted,
      volume: typeof record.volume === 'number' ? clampVolume(record.volume) : DEFAULT_PREFS.volume,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function persistPrefs(): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ muted: prefs.muted, volume: prefs.volume }),
    );
  } catch {
    // Persistence is best-effort.
  }
}

function ensurePrefs(): GameAudioPreferences {
  if (!prefsLoaded) {
    prefs = readStoredPrefs();
    prefsLoaded = true;
  }
  return prefs;
}

function snapshotPrefs(): GameAudioPreferences {
  if (prefsSnapshot.muted !== prefs.muted || prefsSnapshot.volume !== prefs.volume) {
    prefsSnapshot = { muted: prefs.muted, volume: prefs.volume };
  }
  return prefsSnapshot;
}

function emitPrefs(): void {
  const snapshot = snapshotPrefs();
  listeners.forEach((listener) => listener(snapshot));
}

function applyNodeVolume(node: PoolNode): void {
  node.el.volume = clampVolume(prefs.volume * node.gain);
}

function ensureEngine(): PoolNode[] | null {
  if (!isBrowser()) {
    return null;
  }
  ensurePrefs();
  if (!pool) {
    pool = Array.from({ length: POOL_SIZE }, () => {
      const el = new Audio();
      el.preload = 'auto';
      return { el, busy: false, gain: 1 };
    });
  }
  return pool;
}

function releaseNode(node: PoolNode): void {
  if (!node.busy) {
    return;
  }
  node.busy = false;
  activeCount = Math.max(0, activeCount - 1);
}

function pickNode(): PoolNode | null {
  const nodes = ensureEngine();
  if (!nodes) {
    return null;
  }
  return nodes.find((node) => !node.busy) ?? null;
}

function documentIsHidden(): boolean {
  return isBrowser() && document.hidden === true;
}

export function getGameAudioPreferences(): GameAudioPreferences {
  ensurePrefs();
  return snapshotPrefs();
}

export function getGameAudioServerSnapshot(): GameAudioPreferences {
  return DEFAULT_PREFS;
}

export function subscribeGameAudioPreferences(
  listener: (prefs: GameAudioPreferences) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setGameAudioMuted(muted: boolean): void {
  ensurePrefs();
  prefs = { ...prefs, muted: Boolean(muted) };
  persistPrefs();
  if (prefs.muted) {
    stopAllGameSounds();
  }
  emitPrefs();
}

export function setGameAudioVolume(volume: number): void {
  ensurePrefs();
  prefs = { ...prefs, volume: clampVolume(volume) };
  persistPrefs();
  pool?.forEach(applyNodeVolume);
  emitPrefs();
}

/** Silent unlock after a real user gesture. Idempotent. Never throws. */
export function unlockGameAudio(): void {
  if (!isBrowser() || unlocked || unlocking) {
    return;
  }

  const nodes = ensureEngine();
  const node = nodes?.[0];
  if (!node) {
    return;
  }

  unlocking = true;

  try {
    const src = SOUND_SRC['timer-start'];
    if (!src) {
      unlocked = true;
      unlocking = false;
      return;
    }
    node.el.muted = true;
    node.el.volume = 0;
    node.el.src = src;
    const playPromise = node.el.play();
    const finish = (): void => {
      try {
        node.el.pause();
        node.el.currentTime = 0;
      } catch {
        // ignore
      }
      node.el.muted = false;
      applyNodeVolume(node);
      unlocked = true;
      unlocking = false;
    };

    if (playPromise && typeof playPromise.then === 'function') {
      void playPromise.then(finish).catch(() => {
        node.el.muted = false;
        applyNodeVolume(node);
        unlocking = false;
      });
      return;
    }

    finish();
  } catch {
    unlocking = false;
  }
}

export function playGameSound(id: GameSoundId, options?: PlayGameSoundOptions): void {
  if (!isBrowser()) {
    return;
  }

  ensurePrefs();

  if (!unlocked || prefs.muted || documentIsHidden()) {
    return;
  }

  const src = SOUND_SRC[id];
  if (!src) {
    return;
  }

  const eventKey = options?.eventKey;
  if (eventKey && eventKeys.has(eventKey)) {
    return;
  }

  const now = Date.now();
  const previous = lastPlayedAt.get(id) ?? 0;
  if (now - previous < SAME_SOUND_THROTTLE_MS) {
    return;
  }

  if (activeCount >= MAX_CONCURRENT) {
    return;
  }

  const node = pickNode();
  if (!node) {
    return;
  }

  try {
    if (eventKey) {
      if (eventKeys.size >= EVENT_KEY_LIMIT) {
        eventKeys.clear();
      }
      eventKeys.add(eventKey);
    }
    lastPlayedAt.set(id, now);
    node.gain = SOUND_GAIN[id] ?? 1;
    node.el.src = src;
    applyNodeVolume(node);
    node.el.currentTime = 0;
    node.busy = true;
    activeCount += 1;
    node.el.onended = () => {
      releaseNode(node);
    };

    const playPromise = node.el.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      void playPromise.catch(() => {
        releaseNode(node);
      });
    }
  } catch {
    releaseNode(node);
  }
}

export function stopAllGameSounds(): void {
  if (!pool) {
    activeCount = 0;
    return;
  }
  for (const node of pool) {
    try {
      node.el.pause();
      node.el.currentTime = 0;
    } catch {
      // ignore
    }
    node.busy = false;
  }
  activeCount = 0;
}

export function clearGameAudioEventKeys(): void {
  eventKeys.clear();
  lastPlayedAt.clear();
}

export function playSoftCardRequestPing(): void {
  playGameSound('card-request');
}

export function resetGameAudioForTests(): void {
  stopAllGameSounds();
  pool = null;
  unlocked = false;
  unlocking = false;
  prefs = { ...DEFAULT_PREFS };
  prefsSnapshot = { ...DEFAULT_PREFS };
  prefsLoaded = false;
  eventKeys.clear();
  lastPlayedAt.clear();
  activeCount = 0;
  listeners.clear();
}
