'use client';

import { ElectronicPanel } from './electronic-panel';

export function HiddenTimingScreen() {
  return (
    <ElectronicPanel ariaLabel="التوقيت جارٍ" className="min-h-[220px]">
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <span className="text-3xl" aria-hidden>
          ⏱️
        </span>
        <p className="text-xl font-bold text-wanas-accent">التوقيت جارٍ...</p>
        <p className="text-sm text-wanas-text-muted">اعتمد على إحساسك بالوقت</p>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          <span className="size-2 animate-pulse rounded-full bg-wanas-accent" />
          <span className="size-2 animate-pulse rounded-full bg-wanas-accent [animation-delay:150ms]" />
          <span className="size-2 animate-pulse rounded-full bg-wanas-accent [animation-delay:300ms]" />
        </div>
      </div>
    </ElectronicPanel>
  );
}
