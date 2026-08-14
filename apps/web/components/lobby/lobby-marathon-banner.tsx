export function LobbyMarathonBanner() {
  return (
    <section
      aria-label="ماراثون الألعاب"
      className="flex items-center gap-3 rounded-xl border border-wanas-border bg-wanas-surface px-3 py-2"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-wanas-warning-surface text-lg"
        aria-hidden
      >
        🏆
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-wanas-text-primary">ماراثون الألعاب</p>
        <p className="text-[11px] leading-4 text-wanas-text-muted">سلسلة ألعاب ممتعة — جوائز رائعة</p>
      </div>
      <span className="hidden text-[11px] text-wanas-text-muted sm:inline">
        ترقبوا انطلاق التحديات والمكافآت قريباً!
      </span>
      <span className="shrink-0 rounded-full bg-wanas-primary-surface px-2.5 py-1 text-[11px] font-semibold text-wanas-accent">
        قريباً
      </span>
    </section>
  );
}
