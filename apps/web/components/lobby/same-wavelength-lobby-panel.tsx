'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  SameWavelengthLobbyView,
  SameWavelengthRole,
  SameWavelengthTeam,
} from '@wanasatna/shared';
import {
  SAME_WAVELENGTH_ASSIGN_EVENT,
  SAME_WAVELENGTH_LOBBY_SYNC_EVENT,
  SAME_WAVELENGTH_PHASE_CHANGED_EVENT,
  SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';
import { cn } from '@/lib/utils';

type ViewResponse = { view: SameWavelengthLobbyView };

const teamLabel: Record<SameWavelengthTeam, string> = { red: 'الأحمر', blue: 'الأزرق' };
const roleLabel: Record<SameWavelengthRole, string> = {
  'clue-giver': 'ملمّح',
  guesser: 'مخمّن',
};

export function SameWavelengthLobbyPanel({ isActiveMatch }: { isActiveMatch: boolean }) {
  const [view, setView] = useState<SameWavelengthLobbyView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(async () => {
    const response = await emitPluginWithAck<ViewResponse>(SAME_WAVELENGTH_LOBBY_SYNC_EVENT);
    if (response.success) {
      setView(response.data.view);
      setError(null);
    } else if (response.error.code === 'RATE_LIMITED') {
      return 'rate-limited' as const;
    } else {
      setError(response.error.message);
    }
  }, []);

  useEffect(
    () => bindPluginViewResync(getRoomSocket(), SAME_WAVELENGTH_PHASE_CHANGED_EVENT, sync),
    [sync],
  );

  async function run(event: string, payload: unknown) {
    if (busy || isActiveMatch) return;
    setBusy(true);
    const response = await emitPluginWithAck<ViewResponse>(event, payload);
    if (response.success) {
      setView(response.data.view);
      setError(null);
    } else {
      setError(response.error.message);
    }
    setBusy(false);
  }

  if (!view) {
    return (
      <div className="border-wanas-border bg-wanas-surface-soft text-wanas-text-muted rounded-xl border p-3 text-sm">
        {error ?? 'جارٍ تحميل إعدادات على نفس الموجة…'}
      </div>
    );
  }

  const editable = view.canEditSettings && !busy && !isActiveMatch;
  const self = view.roster.find((player) => player.playerId === view.selfPlayerId);
  return (
    <div className="space-y-3" data-same-wavelength-lobby="">
      <div className="border-wanas-accent/30 bg-wanas-primary-surface rounded-xl border p-3">
        <p className="text-wanas-text-primary text-sm font-bold">على نفس الموجة</p>
        <p className="text-wanas-text-muted mt-1 text-xs">
          يكتب الملمّح مثالًا يقود الآخرين إلى نقطة سرية بين مفهومين متعاكسين.
        </p>
      </div>

      <fieldset disabled={!editable} className="space-y-2 disabled:opacity-75">
        <legend className="text-wanas-text-primary text-xs font-bold">وضع المباراة</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['individual', 'فردي · 5 جولات', 'ملمّح جديد كل جولة، وبقية اللاعبين يتنافسون.'],
              ['team', 'فرق · 3 جولات كاملة', 'دور للأحمر ثم دور للأزرق في كل جولة.'],
            ] as const
          ).map(([mode, label, description]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view.settings.mode === mode}
              onClick={() => void run(SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT, { mode })}
              className={cn(
                'min-h-16 rounded-xl border p-3 text-right disabled:cursor-default',
                view.settings.mode === mode
                  ? 'border-wanas-accent bg-wanas-primary-surface'
                  : 'border-wanas-border bg-wanas-surface-soft',
              )}
            >
              <span className="text-wanas-text-primary block text-sm font-bold">{label}</span>
              <span className="text-wanas-text-muted mt-1 block text-xs">{description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="border-wanas-border bg-wanas-surface-soft grid gap-2 rounded-xl border p-3 text-xs sm:grid-cols-3">
        <span>الجولات: {view.settings.roundCount}</span>
        <span>كتابة التلميح: {view.settings.clueSeconds} ثانية</span>
        <span>التخمين: {view.settings.guessingSeconds} ثانية</span>
      </div>

      {view.settings.mode === 'team' && self ? (
        <section className="space-y-2">
          <p className="text-wanas-text-primary text-xs font-bold">اختر فريقك ودورك</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['red', 'blue'] as const).flatMap((team) =>
              (['clue-giver', 'guesser'] as const).map((role) => {
                const selected = self.assignment?.team === team && self.assignment?.role === role;
                return (
                  <button
                    key={`${team}-${role}`}
                    type="button"
                    disabled={busy || isActiveMatch}
                    aria-pressed={selected}
                    onClick={() => void run(SAME_WAVELENGTH_ASSIGN_EVENT, { team, role })}
                    className={cn(
                      'min-h-12 rounded-xl border px-2 text-xs font-bold',
                      selected
                        ? team === 'red'
                          ? 'border-red-400 bg-red-500/20 text-red-100'
                          : 'border-blue-400 bg-blue-500/20 text-blue-100'
                        : 'border-wanas-border bg-wanas-surface',
                    )}
                  >
                    {teamLabel[team]} · {roleLabel[role]}
                  </button>
                );
              }),
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['red', 'blue'] as const).map((team) => (
              <div key={team} className="border-wanas-border rounded-xl border p-2">
                <p className="text-wanas-text-primary text-xs font-bold">
                  الفريق {teamLabel[team]}
                </p>
                <ul className="text-wanas-text-muted mt-1 space-y-1 text-xs">
                  {view.roster
                    .filter((player) => player.assignment?.team === team)
                    .map((player) => (
                      <li key={player.playerId} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate">{player.name}</span>
                        <span>{roleLabel[player.assignment!.role]}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className={cn('text-xs', view.canStart ? 'text-emerald-300' : 'text-amber-200')}>
        {view.canStart ? 'التوزيع جاهز لبدء المباراة.' : view.validationMessage}
      </p>
      {error ? (
        <p role="alert" className="text-wanas-error text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
