'use client';

import { DigitalTimerDisplay, ElectronicPanel } from './electronic-panel';

export function HiddenTimingScreen() {
  return (
    <ElectronicPanel ariaLabel="التوقيت جارٍ" className="min-h-[220px]">
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <DigitalTimerDisplay value="--:--.--" running label="المؤقت يعمل..." />
        <p className="text-sm text-wanas-text-muted">اعتمد على إحساسك بالوقت</p>
      </div>
    </ElectronicPanel>
  );
}
