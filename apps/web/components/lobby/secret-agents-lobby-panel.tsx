'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SecretAgentsLobbyView, SecretAgentsRole, SecretAgentsTeam } from '@wanasatna/shared';
import {
  SECRET_AGENTS_ASSIGN_EVENT,
  SECRET_AGENTS_LOBBY_SYNC_EVENT,
  SECRET_AGENTS_PHASE_CHANGED_EVENT,
  SECRET_AGENTS_RANDOMIZE_EVENT,
  SECRET_AGENTS_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';
import { cn } from '@/lib/utils';
import { PlayerAvatar } from '@/components/player/player-avatar';
import { useRoom } from '@/contexts/room-context';

type ViewResponse = { view: SecretAgentsLobbyView };

const roleLabel: Record<SecretAgentsRole, string> = {
  spymaster: 'قائد',
  operative: 'مخمّن',
};

export function SecretAgentsLobbyPanel({ isActiveMatch }: { isActiveMatch: boolean }) {
  const { players } = useRoom();
  const [view, setView] = useState<SecretAgentsLobbyView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(async () => {
    const response = await emitPluginWithAck<ViewResponse>(SECRET_AGENTS_LOBBY_SYNC_EVENT);
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
    () => bindPluginViewResync(getRoomSocket(), SECRET_AGENTS_PHASE_CHANGED_EVENT, sync),
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

  function assign(team: SecretAgentsTeam, role: SecretAgentsRole) {
    void run(SECRET_AGENTS_ASSIGN_EVENT, { team, role });
  }

  if (!view) {
    return (
      <div className="border-wanas-border bg-wanas-surface-soft text-wanas-text-muted rounded-xl border p-3 text-sm">
        {error ?? 'جارٍ تحميل توزيع الفرق…'}
      </div>
    );
  }

  const groups = {
    unassigned: view.roster.filter((entry) => !entry.assignment),
    red: view.roster.filter((entry) => entry.assignment?.team === 'red'),
    blue: view.roster.filter((entry) => entry.assignment?.team === 'blue'),
  };
  const self = view.roster.find((entry) => entry.playerId === view.selfPlayerId);
  const roomPlayerById = new Map(players.map((entry) => [entry.id, entry]));

  return (
    <div className="space-y-3" data-secret-agents-lobby="">
      <div className="border-wanas-accent/30 bg-wanas-primary-surface rounded-xl border p-3">
        <p className="text-wanas-text-primary text-sm font-bold">جهّز الفريقين</p>
        <p className="text-wanas-text-muted mt-1 text-xs">
          اختر فريقك ودورك. يحتاج كل فريق إلى قائد ومخمّن واحد على الأقل.
        </p>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        {(
          [
            ['unassigned', 'غير معيّنين'],
            ['red', 'الفريق الأحمر'],
            ['blue', 'الفريق الأزرق'],
          ] as const
        ).map(([group, label]) => (
          <section
            key={group}
            className={cn(
              'rounded-xl border p-3',
              group === 'red'
                ? 'border-red-400/40 bg-red-500/10'
                : group === 'blue'
                  ? 'border-blue-400/40 bg-blue-500/10'
                  : 'border-wanas-border bg-wanas-surface-soft',
            )}
          >
            <h4 className="text-wanas-text-primary text-xs font-bold">{label}</h4>
            <ul className="text-wanas-text-muted mt-2 space-y-1 text-xs">
              {groups[group].length === 0 ? <li>لا يوجد</li> : null}
              {groups[group].map((entry) => {
                const roomPlayer = roomPlayerById.get(entry.playerId);
                return (
                  <li
                    key={entry.playerId}
                    className={cn(
                      'flex min-w-0 items-center justify-between gap-2 rounded-lg bg-black/10 px-2 py-1.5',
                      !entry.isConnected && 'opacity-55',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PlayerAvatar
                        playerId={entry.playerId}
                        playerName={entry.name}
                        avatarId={roomPlayer?.avatarId}
                        className="size-8"
                        sizes="32px"
                      />
                      <span className="min-w-0 truncate" title={entry.name}>
                        {entry.name}
                      </span>
                      {roomPlayer?.isHost ? (
                        <span title="المضيف" aria-label="المضيف">
                          👑
                        </span>
                      ) : null}
                    </span>
                    {entry.assignment ? (
                      <span className="shrink-0 rounded-full bg-black/15 px-2 py-0.5">
                        {roleLabel[entry.assignment.role]}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <section className="border-wanas-border bg-wanas-surface-soft rounded-xl border p-3">
        <p className="text-wanas-text-primary text-xs font-bold">
          اختيارك الحالي:{' '}
          {self?.assignment
            ? `${self.assignment.team === 'red' ? 'الأحمر' : 'الأزرق'} — ${roleLabel[self.assignment.role]}`
            : 'غير معيّن'}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['red', 'blue'] as const).flatMap((team) =>
            (['spymaster', 'operative'] as const).map((role) => (
              <button
                key={`${team}-${role}`}
                type="button"
                disabled={busy || isActiveMatch}
                onClick={() => assign(team, role)}
                className={cn(
                  'min-h-11 rounded-lg border px-2 text-xs font-bold disabled:opacity-50',
                  team === 'red'
                    ? 'border-red-400/50 bg-red-500/15 text-red-100'
                    : 'border-blue-400/50 bg-blue-500/15 text-blue-100',
                )}
              >
                {team === 'red' ? 'أحمر' : 'أزرق'} — {roleLabel[role]}
              </button>
            )),
          )}
        </div>
        {view.canRandomize ? (
          <button
            type="button"
            disabled={busy || isActiveMatch}
            onClick={() => void run(SECRET_AGENTS_RANDOMIZE_EVENT, {})}
            className="border-wanas-accent/50 text-wanas-text-primary mt-2 min-h-11 w-full rounded-lg border px-3 text-xs font-bold disabled:opacity-50"
          >
            توزيع عشوائي صالح (اختياري)
          </button>
        ) : null}
        <p className={cn('mt-2 text-xs', view.canStart ? 'text-emerald-300' : 'text-amber-200')}>
          {view.canStart ? 'التوزيع جاهز لبدء المباراة.' : view.validationMessage}
        </p>
      </section>

      <section className="border-wanas-border bg-wanas-surface-soft rounded-xl border p-3">
        <h4 className="text-wanas-text-primary text-xs font-bold">المؤقتات (مثبّتة عند البدء)</h4>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <TimerControl
            label="وقت القائد"
            enabled={view.settings.clueTimerEnabled}
            seconds={view.settings.clueSeconds}
            editable={view.canEditSettings && !isActiveMatch}
            onToggle={(enabled) =>
              void run(SECRET_AGENTS_UPDATE_SETTINGS_EVENT, { clueTimerEnabled: enabled })
            }
            onSeconds={(seconds) =>
              void run(SECRET_AGENTS_UPDATE_SETTINGS_EVENT, { clueSeconds: seconds })
            }
          />
          <TimerControl
            label="وقت المخمّنين"
            enabled={view.settings.operativeTimerEnabled}
            seconds={view.settings.operativeSeconds}
            editable={view.canEditSettings && !isActiveMatch}
            onToggle={(enabled) =>
              void run(SECRET_AGENTS_UPDATE_SETTINGS_EVENT, { operativeTimerEnabled: enabled })
            }
            onSeconds={(seconds) =>
              void run(SECRET_AGENTS_UPDATE_SETTINGS_EVENT, { operativeSeconds: seconds })
            }
          />
        </div>
        <label className="text-wanas-text-muted mt-3 flex items-center justify-between gap-3 text-xs">
          مكافأة كل تخمين صحيح
          <input
            type="number"
            min={0}
            max={60}
            value={view.settings.correctGuessBonusSeconds}
            disabled={!view.canEditSettings || isActiveMatch}
            onChange={(event) => {
              const seconds = Number(event.target.value);
              if (Number.isInteger(seconds) && seconds >= 0 && seconds <= 60) {
                void run(SECRET_AGENTS_UPDATE_SETTINGS_EVENT, {
                  correctGuessBonusSeconds: seconds,
                });
              }
            }}
            className="border-wanas-border bg-wanas-surface text-wanas-text-primary h-11 w-24 rounded-lg border px-2 text-center disabled:opacity-60"
          />
        </label>
      </section>

      {error ? (
        <p role="alert" className="text-wanas-error text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TimerControl(props: {
  label: string;
  enabled: boolean;
  seconds: number;
  editable: boolean;
  onToggle: (enabled: boolean) => void;
  onSeconds: (seconds: number) => void;
}) {
  return (
    <div className="border-wanas-border bg-wanas-surface rounded-lg border p-2">
      <label className="text-wanas-text-primary flex min-h-11 items-center justify-between gap-2 text-xs font-semibold">
        {props.label}
        <input
          type="checkbox"
          checked={props.enabled}
          disabled={!props.editable}
          onChange={(event) => props.onToggle(event.target.checked)}
          className="size-5 accent-[var(--wanas-accent)]"
        />
      </label>
      <label className="text-wanas-text-muted mt-1 flex items-center justify-between gap-2 text-xs">
        المدة بالثواني
        <input
          type="number"
          min={15}
          max={300}
          value={props.seconds}
          disabled={!props.editable}
          onChange={(event) => {
            const seconds = Number(event.target.value);
            if (Number.isInteger(seconds) && seconds >= 15 && seconds <= 300)
              props.onSeconds(seconds);
          }}
          className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary h-11 w-24 rounded-lg border px-2 text-center disabled:opacity-60"
        />
      </label>
    </div>
  );
}
