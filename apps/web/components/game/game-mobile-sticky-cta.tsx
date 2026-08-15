import type { ReactNode } from 'react';

export function GameMobileStickyCta({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[color:var(--wanas-game-card-border)] bg-[color:var(--wanas-game-bg-from)]/95 px-3 pt-2 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
    >
      {children}
    </div>
  );
}

export function GameMobileStickyCtaSpacer() {
  return (
    <div
      aria-hidden
      className="h-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:hidden"
    />
  );
}
