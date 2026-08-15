'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
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

function placeAudioPanel(trigger: DOMRect): { top: number; left: number; width: number } {
  const margin = 12;
  const width = Math.min(264, Math.max(180, window.innerWidth - margin * 2));
  let left = trigger.left;
  if (left + width > window.innerWidth - margin) {
    left = window.innerWidth - margin - width;
  }
  if (left < margin) {
    left = margin;
  }
  return { top: trigger.bottom + 6, left, width };
}

export function GameAudioControl({ className }: { className?: string }) {
  const prefs = useSyncExternalStore(
    subscribeGameAudioPreferences,
    getGameAudioPreferences,
    getGameAudioServerSnapshot,
  );
  const [open, setOpen] = useState(false);
  const [panelBox, setPanelBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const volumeId = useId();
  const percent = Math.round(prefs.volume * 100);

  useLayoutEffect(() => {
    if (!open) {
      setPanelBox(null);
      return;
    }
    const place = (): void => {
      const trigger = rootRef.current?.querySelector('[data-testid="game-audio-control"]');
      if (!trigger) {
        return;
      }
      setPanelBox(placeAudioPanel(trigger.getBoundingClientRect()));
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          'inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg',
          'border border-[color:var(--wanas-game-panel-border,var(--wanas-border))]',
          'bg-[color:var(--wanas-game-card,var(--wanas-surface-soft))]',
          'text-[color:var(--wanas-game-text-primary,var(--wanas-text-primary))]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/45',
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={prefs.muted ? 'تشغيل الصوت' : 'إعدادات الصوت'}
        data-testid="game-audio-control"
        data-muted={prefs.muted ? 'true' : 'false'}
        onClick={() => {
          unlockGameAudio();
          setOpen((current) => !current);
        }}
      >
        <SpeakerIcon muted={prefs.muted} />
      </button>

      {open && panelBox ? (
        <div
          role="dialog"
          aria-labelledby={headingId}
          data-testid="game-audio-panel"
          className="fixed z-50 overflow-x-hidden rounded-xl border border-wanas-border bg-wanas-surface p-3 shadow-[var(--wanas-shadow-panel)]"
          style={{ top: panelBox.top, left: panelBox.left, width: panelBox.width }}
        >
          <p id={headingId} className="text-sm font-semibold text-wanas-text-primary">
            الصوت
          </p>
          <button
            type="button"
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-wanas-border px-3 text-sm font-medium text-wanas-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/45 md:min-h-9"
            data-testid="game-audio-mute-toggle"
            aria-pressed={prefs.muted}
            onClick={() => {
              unlockGameAudio();
              setGameAudioMuted(!prefs.muted);
            }}
          >
            <SpeakerIcon muted={prefs.muted} />
            {prefs.muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          </button>
          <label htmlFor={volumeId} className="mt-3 block text-xs font-medium text-wanas-text-muted">
            مستوى الصوت
          </label>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <input
              id={volumeId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={percent}
              aria-label="مستوى الصوت"
              data-testid="game-audio-volume"
              className="h-11 min-h-11 min-w-0 w-full accent-wanas-accent md:h-9 md:min-h-9"
              onChange={(event) => {
                unlockGameAudio();
                setGameAudioVolume(Number(event.target.value) / 100);
              }}
            />
            <span className="w-9 shrink-0 text-end text-xs tabular-nums text-wanas-text-secondary" dir="ltr">
              {percent}%
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
