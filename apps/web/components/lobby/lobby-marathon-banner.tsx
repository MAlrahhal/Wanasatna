import { cn } from '@/lib/utils';

export function LobbyMarathonBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-wanas-accent/40 bg-wanas-surface-soft p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-wanas-border bg-wanas-surface text-xl"
          aria-hidden
        >
          🏆
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-wanas-text-primary">ماراثون الألعاب</h3>
          <p className="mt-0.5 text-xs leading-5 text-wanas-text-muted">
            سلسلة ألعاب متتابعة في جلسة واحدة — قريباً.
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled
        aria-disabled="true"
        className={cn(
          'inline-flex h-11 min-h-[44px] w-full shrink-0 items-center justify-center rounded-full bg-wanas-accent px-6 text-sm font-bold text-white sm:w-auto',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        ابدأ الماراثون
      </button>
    </div>
  );
}
