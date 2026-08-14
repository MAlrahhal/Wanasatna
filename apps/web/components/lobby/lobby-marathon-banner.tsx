import { cn } from '@/lib/utils';

export function LobbyMarathonBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-wanas-border bg-wanas-surface-soft px-3 py-2">
      <span className="text-base" aria-hidden>
        🏆
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-wanas-text-primary">ماراثون الألعاب</p>
        <p className="text-[11px] leading-4 text-wanas-text-muted">سلسلة ألعاب متتابعة — قريباً.</p>
      </div>
      <span className={cn('shrink-0 text-[11px] font-semibold text-wanas-text-muted')}>قريباً</span>
    </div>
  );
}
