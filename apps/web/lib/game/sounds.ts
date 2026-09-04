/**
 * Shared SFX engine. Original cues live in /public/audio/sfx/.
 */

export type GameSoundId =
  | 'countdown-tick'
  | 'go'
  | 'your-turn'
  | 'correct'
  | 'wrong'
  | 'time-up'
  | 'round-result'
  | 'match-win'
  | 'notify';

export type GameAudioPreferences = {
  muted: boolean;
};

export type PlayGameSoundOptions = {
  eventKey?: string;
};

const PREFS_KEY = 'wanasatna:audio-prefs';
const DEFAULT_PREFS: GameAudioPreferences = { muted: false };
const MASTER_VOLUME = 1;
const POOL_SIZE = 3;
const MAX_CONCURRENT = 2;
const SAME_SOUND_THROTTLE_MS = 120;
const EVENT_KEY_LIMIT = 256;
const CORRECT_ROUND_RESULT_GAP_MS = 450;

const SOUND_SRC: Record<GameSoundId, string> = {
  'countdown-tick': '/audio/sfx/countdown-tick.wav',
  go: '/audio/sfx/go.wav',
  'your-turn': '/audio/sfx/your-turn.wav',
  correct: '/audio/sfx/correct.wav',
  wrong: '/audio/sfx/wrong.wav',
  'time-up': '/audio/sfx/time-up.wav',
  'round-result': '/audio/sfx/round-result.wav',
  'match-win': '/audio/sfx/match-win.wav',
  notify: '/audio/sfx/notify.wav',
};

const SOUND_GAIN: Record<GameSoundId, number> = {
  'countdown-tick': 0.52,
  notify: 0.48,
  wrong: 0.62,
  'your-turn': 0.72,
  correct: 0.78,
  'time-up': 0.78,
  'round-result': 0.72,
  go: 0.78,
  'match-win': 0.92,
};

const SOUND_PRIORITY: Record<GameSoundId, number> = {
  'match-win': 90,
  'time-up': 80,
  go: 70,
  'your-turn': 60,
  correct: 50,
  wrong: 40,
  'round-result': 30,
  'countdown-tick': 20,
  notify: 10,
};

type PoolNode = {
  el: HTMLAudioElement;
  busy: boolean;
  gain: number;
  priority: number;
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

function clampGain(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
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
    const record = parsed as { muted?: unknown };
    return {
      muted: typeof record.muted === 'boolean' ? record.muted : DEFAULT_PREFS.muted,
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
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ muted: prefs.muted }));
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
  if (prefsSnapshot.muted !== prefs.muted) {
    prefsSnapshot = { muted: prefs.muted };
  }
  return prefsSnapshot;
}

function emitPrefs(): void {
  const snapshot = snapshotPrefs();
  listeners.forEach((listener) => listener(snapshot));
}

function applyNodeVolume(node: PoolNode): void {
  node.el.volume = clampGain(MASTER_VOLUME * node.gain);
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
      return { el, busy: false, gain: 1, priority: 0 };
    });
  }
  return pool;
}

function releaseNode(node: PoolNode): void {
  if (!node.busy) {
    return;
  }
  node.busy = false;
  node.priority = 0;
  activeCount = Math.max(0, activeCount - 1);
}

function stopNode(node: PoolNode): void {
  try {
    node.el.pause();
    node.el.currentTime = 0;
  } catch {
    // ignore
  }
  releaseNode(node);
}

function pickNode(priority: number): PoolNode | null {
  const nodes = ensureEngine();
  if (!nodes) {
    return null;
  }
  if (activeCount < MAX_CONCURRENT) {
    return nodes.find((node) => !node.busy) ?? null;
  }
  const busy = nodes.filter((node) => node.busy).sort((a, b) => a.priority - b.priority);
  const victim = busy[0];
  if (!victim || victim.priority >= priority) {
    return null;
  }
  stopNode(victim);
  return victim;
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
  prefs = { muted: Boolean(muted) };
  persistPrefs();
  if (prefs.muted) {
    stopAllGameSounds();
  }
  emitPrefs();
}

export function isGameAudioUnlocked(): boolean {
  return unlocked;
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
    const src = SOUND_SRC.go;
    node.el.muted = true;
    node.el.volume = 0;
    node.el.src = src;
    node.busy = true;
    activeCount += 1;
    const playPromise = node.el.play();
    // Gesture already started playback; later SFX must not wait on this promise.
    unlocked = true;

    const finish = (): void => {
      try {
        node.el.pause();
        node.el.currentTime = 0;
      } catch {
        // ignore
      }
      node.el.muted = false;
      applyNodeVolume(node);
      releaseNode(node);
      unlocking = false;
    };

    if (playPromise && typeof playPromise.then === 'function') {
      void playPromise.then(finish).catch(() => {
        node.el.muted = false;
        applyNodeVolume(node);
        releaseNode(node);
        unlocking = false;
      });
      return;
    }

    finish();
  } catch {
    if (node.busy) {
      releaseNode(node);
    }
    unlocking = false;
  }
}

function rememberEventKey(eventKey: string | undefined): void {
  if (!eventKey) {
    return;
  }
  if (eventKeys.size >= EVENT_KEY_LIMIT) {
    eventKeys.clear();
  }
  eventKeys.add(eventKey);
}

export function playGameSound(id: GameSoundId, options?: PlayGameSoundOptions): void {
  if (!isBrowser()) {
    return;
  }

  ensurePrefs();

  if (!unlocked) {
    return;
  }

  const eventKey = options?.eventKey;
  if (eventKey && eventKeys.has(eventKey)) {
    return;
  }

  if (prefs.muted || documentIsHidden()) {
    rememberEventKey(eventKey);
    return;
  }

  const src = SOUND_SRC[id];
  if (!src) {
    return;
  }

  const now = Date.now();
  if (id === 'round-result') {
    const correctAt = lastPlayedAt.get('correct') ?? 0;
    if (now - correctAt < CORRECT_ROUND_RESULT_GAP_MS) {
      rememberEventKey(eventKey);
      return;
    }
  }

  const previous = lastPlayedAt.get(id) ?? 0;
  if (now - previous < SAME_SOUND_THROTTLE_MS) {
    return;
  }

  const priority = SOUND_PRIORITY[id];
  const node = pickNode(priority);
  if (!node) {
    return;
  }

  try {
    rememberEventKey(eventKey);
    lastPlayedAt.set(id, now);
    node.gain = SOUND_GAIN[id];
    node.priority = priority;
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
    node.priority = 0;
  }
  activeCount = 0;
}

export function clearGameAudioEventKeys(): void {
  eventKeys.clear();
  lastPlayedAt.clear();
}

export function playSoftCardRequestPing(options?: PlayGameSoundOptions): void {
  playGameSound('notify', options);
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
