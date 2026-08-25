'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMarathon } from '@/contexts/marathon-context';
import { useRoom } from '@/contexts/room-context';

export function LobbyMarathonBanner() {
  const { isHost } = useRoom();
  const { state, prepare } = useMarathon();
  const [loading, setLoading] = useState(false);

  async function enterMarathon() {
    setLoading(true);
    try {
      await prepare();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-label="ماراثون الألعاب"
      className="border-wanas-accent/35 bg-wanas-surface flex items-center gap-2.5 rounded-xl border px-3 py-2"
    >
      <span
        className="bg-wanas-warning-surface flex size-9 shrink-0 items-center justify-center rounded-full text-lg"
        aria-hidden
      >
        🏆
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-wanas-text-primary text-sm font-bold">ماراثون الألعاب</p>
        <p className="text-wanas-text-muted truncate text-[11px] leading-4">
          عدة ألعاب، غرفة واحدة، وترتيب تراكمي
        </p>
      </div>
      {isHost ? (
        <Button size="sm" type="button" loading={loading} onClick={() => void enterMarathon()}>
          إعداد الماراتون
        </Button>
      ) : (
        <span className="text-wanas-text-muted text-[11px] font-semibold">
          {state?.status === 'PREPARING' ? 'المضيف يجهّز الماراتون' : 'للمضيف'}
        </span>
      )}
    </section>
  );
}
