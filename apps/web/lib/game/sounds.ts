/**
 * Minimal reusable game sound helper.
 * Temporary assets live under /public/sounds and can be replaced later.
 */

export type GameSoundId = 'timer-start';

const SOUND_SRC: Record<GameSoundId, string> = {
  // TEMPORARY development cue — replace with final production SFX later.
  'timer-start': '/sounds/timer-start.wav',
};

let unlocked = false;
let sharedAudio: HTMLAudioElement | null = null;

function getAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }

  return sharedAudio;
}

/** Call from a user gesture (Ready / Start) to unlock autoplay policies. */
export function unlockGameAudio(): void {
  if (typeof window === 'undefined' || unlocked) {
    return;
  }

  const audio = getAudioElement();

  if (!audio) {
    return;
  }

  try {
    audio.src = SOUND_SRC['timer-start'];
    audio.volume = 0;
    const playPromise = audio.play();

    if (playPromise && typeof playPromise.then === 'function') {
      void playPromise
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1;
          unlocked = true;
        })
        .catch(() => {
          audio.volume = 1;
        });
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    unlocked = true;
  } catch {
    // Audio unlock is best-effort; gameplay must continue.
  }
}

export function playGameSound(id: GameSoundId): void {
  if (typeof window === 'undefined') {
    return;
  }

  const src = SOUND_SRC[id];
  const audio = getAudioElement();

  if (!audio || !src) {
    return;
  }

  try {
    audio.src = src;
    audio.volume = 1;
    audio.currentTime = 0;
    const playPromise = audio.play();

    if (playPromise && typeof playPromise.catch === 'function') {
      void playPromise.catch(() => {
        // Autoplay blocked or missing asset — ignore.
      });
    }
  } catch {
    // Never break gameplay for sound failures.
  }
}
