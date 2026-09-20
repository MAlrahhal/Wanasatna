'use client';

import { useId, useSyncExternalStore } from 'react';
import {
  getGameAudioPreferences,
  getGameAudioServerSnapshot,
  setGameAudioMuted,
  setGameAudioVolume,
  subscribeGameAudioPreferences,
  unlockGameAudio,
} from '@/lib/game/sounds';
import { cn } from '@/lib/utils';

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10v4h3.2L12 18.5V5.5L7.2 10H4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {muted ? (
        <path d="M16 9.5 20.5 14.5M20.5 9.5 16 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path
          d="M15.2 8.8a4.2 4.2 0 0 1 0 6.4M17.6 6.6a7.2 7.2 0 0 1 0 10.8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function GameAudioControl({ className }: { className?: string }) {
  const volumeId = useId();
  const prefs = useSyncExternalStore(
    subscribeGameAudioPreferences,
    getGameAudioPreferences,
    getGameAudioServerSnapshot,
  );

  const volumePercent = Math.round(prefs.volume * 100);

  return (
    <div className="group relative inline-flex shrink-0" data-testid="game-audio-control-group">
      <button
        type="button"
        className={cn(
          'inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg',
          'border border-[color:var(--wanas-game-panel-border,var(--wanas-border))]',
          'bg-[color:var(--wanas-game-card,var(--wanas-surface-soft))]',
          'text-[color:var(--wanas-game-text-primary,var(--wanas-text-primary))]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/45',
          className,
        )}
        aria-pressed={prefs.muted}
        aria-label={prefs.muted ? 'الصوت مكتوم' : 'الصوت'}
        data-testid="game-audio-control"
        data-muted={prefs.muted ? 'true' : 'false'}
        onClick={() => {
          unlockGameAudio();
          setGameAudioMuted(!prefs.muted);
        }}
      >
        <SpeakerIcon muted={prefs.muted} />
      </button>

      <div
        className={cn(
          'invisible absolute end-0 top-full z-50 w-36 rounded-xl border p-3 opacity-0 shadow-lg transition',
          'border-[color:var(--wanas-game-panel-border,var(--wanas-border))]',
          'bg-[color:var(--wanas-game-card,var(--wanas-surface))]',
          'text-[color:var(--wanas-game-text-primary,var(--wanas-text-primary))]',
          'group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100',
        )}
        data-testid="game-audio-panel"
      >
        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold">
          <label htmlFor={volumeId}>مستوى الصوت</label>
          <output htmlFor={volumeId} className="tabular-nums" dir="ltr">
            {volumePercent}%
          </output>
        </div>
        <input
          id={volumeId}
          type="range"
          min="0"
          max="100"
          step="1"
          value={volumePercent}
          aria-label="مستوى الصوت"
          className="h-6 w-full cursor-pointer [accent-color:var(--wanas-accent)]"
          dir="ltr"
          onChange={(event) => {
            unlockGameAudio();
            setGameAudioVolume(Number(event.currentTarget.value) / 100);
          }}
        />
      </div>
    </div>
  );
}
