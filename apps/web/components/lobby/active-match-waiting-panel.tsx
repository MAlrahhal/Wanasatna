'use client';

import { LobbyPanel } from './lobby-ui';

export function ActiveMatchWaitingPanel() {
  return (
    <LobbyPanel title="هناك مباراة جارية حاليًا" bodyClassName="p-4">
      <div className="flex flex-col items-center gap-2 rounded-lg border border-wanas-border bg-wanas-surface-soft px-4 py-5 text-center">
        <p className="text-sm font-semibold text-wanas-text-primary">
          يمكنك الانتظار هنا، وستتمكن من المشاركة عند انتهاء المباراة الحالية.
        </p>
        <p className="text-xs font-medium text-wanas-text-muted">
          المباراة الحالية بدأت قبل انضمامك.
        </p>
      </div>
    </LobbyPanel>
  );
}
