'use client';

import { cn } from '@/lib/utils';

export type SpectrumMarker = {
  id: string;
  position: number;
  label: string;
  tone?: 'guess' | 'target' | 'cyan' | 'violet' | 'emerald';
};

export function clampSpectrumPosition(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function stepSpectrumPosition(value: number | null, direction: -1 | 1): number {
  return clampSpectrumPosition((value ?? 50) + direction);
}

function markerInsetPosition(position: number): string {
  return `calc(0.75rem + (100% - 1.5rem) * ${clampSpectrumPosition(position) / 100})`;
}

function markerLabelTransform(position: number): string {
  if (position <= 8) return 'translateX(0)';
  if (position >= 92) return 'translateX(-100%)';
  return 'translateX(-50%)';
}

const markerTone = {
  guess: 'border-white bg-slate-950 text-white',
  target: 'border-amber-200 bg-amber-400 text-slate-950',
  cyan: 'border-cyan-100 bg-cyan-400 text-slate-950',
  violet: 'border-violet-100 bg-violet-400 text-slate-950',
  emerald: 'border-emerald-100 bg-emerald-400 text-slate-950',
} as const;

export function SameWavelengthSpectrum(props: {
  leftLabel: string;
  rightLabel: string;
  value?: number | null;
  onChange?: (value: number) => void;
  disabled?: boolean;
  markers?: readonly SpectrumMarker[];
  showMarkerLegend?: boolean;
  showValue?: boolean;
  ariaLabel?: string;
  compact?: boolean;
  className?: string;
}) {
  const interactive = typeof props.onChange === 'function' && !props.disabled;
  const value = props.value ?? null;
  const markers = props.markers ?? [];

  return (
    <section
      className={cn('min-w-0 space-y-3', props.className)}
      aria-label={`${props.leftLabel} إلى ${props.rightLabel}`}
    >
      <div className="flex items-start justify-between gap-4" dir="ltr">
        <div className="min-w-0 max-w-[46%] text-left">
          <span className="text-wanas-text-muted block text-[11px] font-bold">0</span>
          <span className="text-wanas-text-primary block break-words text-sm font-black sm:text-base">
            {props.leftLabel}
          </span>
        </div>
        <div className="min-w-0 max-w-[46%] text-right">
          <span className="text-wanas-text-muted block text-[11px] font-bold">100</span>
          <span className="text-wanas-text-primary block break-words text-sm font-black sm:text-base">
            {props.rightLabel}
          </span>
        </div>
      </div>

      <div
        className={cn(
          'group/spectrum relative rounded-2xl px-3 py-5 focus-within:ring-2 focus-within:ring-cyan-300 focus-within:ring-offset-2 focus-within:ring-offset-slate-950',
          interactive ? 'bg-white/5' : 'bg-white/[0.03]',
          props.compact && 'py-4',
        )}
        dir="ltr"
      >
        <div className="relative">
          <div
            className={cn(
              'relative h-14 overflow-visible rounded-full border border-white/25 bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-500 shadow-inner',
              props.compact && 'h-11',
            )}
          >
            {[0, 25, 50, 75, 100].map((tick) => (
              <span
                key={tick}
                className="pointer-events-none absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-white/55"
                style={{ left: `${tick}%` }}
                aria-hidden="true"
              />
            ))}

            {markers.map((marker, index) => (
              <span
                key={marker.id}
                className={cn(
                  'pointer-events-none absolute z-20 size-5 -translate-x-1/2 rounded-full border-2 shadow-lg',
                  markerTone[marker.tone ?? 'guess'],
                )}
                style={{
                  left: markerInsetPosition(marker.position),
                  top: index % 2 === 0 ? '0.35rem' : 'calc(100% - 1.6rem)',
                }}
                title={`${marker.label}: ${marker.position}`}
              />
            ))}

            {value !== null ? (
              <>
                <span
                  className="pointer-events-none absolute top-1/2 z-30 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-slate-950 shadow-xl transition-[left] motion-reduce:transition-none"
                  style={{ left: markerInsetPosition(value) }}
                  aria-hidden="true"
                />
                {props.showValue !== false ? (
                  <output
                    className="pointer-events-none absolute -top-3 z-40 rounded-lg bg-slate-950 px-2 py-1 text-xs font-black text-white shadow-lg"
                    style={{
                      left: markerInsetPosition(value),
                      transform: markerLabelTransform(value),
                    }}
                    aria-live="polite"
                  >
                    {value}
                  </output>
                ) : null}
              </>
            ) : null}

            {interactive ? (
              <input
                type="range"
                dir="ltr"
                min={0}
                max={100}
                step={1}
                value={value ?? 50}
                onInput={(event) => props.onChange?.(Number(event.currentTarget.value))}
                onChange={(event) => props.onChange?.(Number(event.currentTarget.value))}
                aria-label={props.ariaLabel ?? 'اختر موقعًا على الطيف من صفر إلى مئة'}
                aria-valuetext={value === null ? 'لم يتم اختيار موقع بعد' : `${value} من 100`}
                className="absolute inset-0 z-50 h-full w-full cursor-pointer touch-none opacity-0 focus:outline-none"
              />
            ) : null}
          </div>

          <div
            className="mt-1 flex justify-between px-1 text-[11px] font-bold text-slate-300 sm:text-xs"
            aria-hidden="true"
          >
            {[0, 25, 50, 75, 100].map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>

          {props.showMarkerLegend && markers.length > 0 ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="مفتاح علامات النتيجة">
              {markers.map((marker) => (
                <li
                  key={`legend-${marker.id}`}
                  className="border-wanas-border bg-wanas-surface-soft flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                >
                  <span
                    className={cn(
                      'size-3 shrink-0 rounded-full border',
                      markerTone[marker.tone ?? 'guess'],
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-wanas-text-primary min-w-0 break-words font-bold">
                    <bdi dir="auto">{marker.label}</bdi>: <bdi dir="ltr">{marker.position}</bdi>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {interactive ? (
          <div className="mt-3 flex items-center justify-center gap-3" dir="ltr">
            <button
              type="button"
              onClick={() => props.onChange?.(stepSpectrumPosition(value, -1))}
              disabled={value === 0}
              aria-label="إنقاص الموقع درجة واحدة"
              className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary focus-visible:ring-wanas-accent flex size-11 items-center justify-center rounded-xl border text-xl font-black focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40"
            >
              −
            </button>
            <p className="text-wanas-text-muted min-w-28 text-center text-xs" dir="rtl">
              {value === null
                ? 'اضغط على المقياس لاختيار موقع، ثم اسحب لتعديله'
                : `الموقع المختار: ${value}`}
            </p>
            <button
              type="button"
              onClick={() => props.onChange?.(stepSpectrumPosition(value, 1))}
              disabled={value === 100}
              aria-label="زيادة الموقع درجة واحدة"
              className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary focus-visible:ring-wanas-accent flex size-11 items-center justify-center rounded-xl border text-xl font-black focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40"
            >
              +
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
