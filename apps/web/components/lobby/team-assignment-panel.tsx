'use client';

import type { PregameTeamSnapshot, TeamId } from '@wanasatna/shared';
import { cn } from '@/lib/utils';

type LobbyPlayer = {
  id: string;
  name: string;
  isHost?: boolean;
  isConnected?: boolean;
};

type TeamAssignmentPanelProps = {
  snapshot: PregameTeamSnapshot | null;
  players: LobbyPlayer[];
  isHost: boolean;
  onAssign: (playerId: string, teamId: TeamId) => void;
  onRandomize: () => void;
};

function TeamColumn({
  title,
  tone,
  members,
  capacity,
  isHost,
  onMove,
  otherTeam,
}: {
  title: string;
  tone: 'blue' | 'red';
  members: LobbyPlayer[];
  capacity: number;
  isHost: boolean;
  onMove: (playerId: string) => void;
  otherTeam: TeamId;
}) {
  const slots = Array.from({ length: capacity }, (_, index) => members[index] ?? null);

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        tone === 'blue'
          ? 'border-sky-400/40 bg-sky-500/10'
          : 'border-rose-400/40 bg-rose-500/10',
      )}
      data-testid={`team-column-${tone}`}
    >
      <p className="text-sm font-bold text-wanas-text-primary">
        {tone === 'blue' ? '🔵' : '🔴'} {title}
        <span className="ms-2 text-[11px] font-medium text-wanas-text-muted">
          {members.length}/{capacity}
        </span>
      </p>
      <ul className="mt-2 space-y-1.5">
        {slots.map((player, index) => (
          <li
            key={player?.id ?? `empty-${index}`}
            className="flex min-h-9 items-center justify-between gap-2 rounded-lg border border-wanas-border/60 bg-wanas-surface-soft/80 px-2.5 py-1.5"
          >
            {player ? (
              <>
                <span className="truncate text-xs font-semibold text-wanas-text-primary">
                  {player.name}
                  {player.isHost ? ' · مضيف' : ''}
                  {player.isConnected === false ? ' · غير متصل' : ''}
                </span>
                {isHost ? (
                  <button
                    type="button"
                    data-testid={`team-move-${player.id}`}
                    className="shrink-0 rounded-md border border-wanas-border px-2 py-0.5 text-[10px] font-semibold text-wanas-text-secondary"
                    onClick={() => onMove(player.id)}
                  >
                    إلى {otherTeam === 'blue' ? 'الأزرق' : 'الأحمر'}
                  </button>
                ) : null}
              </>
            ) : (
              <span className="text-[11px] text-wanas-text-muted">مقعد فارغ</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamAssignmentPanel({
  snapshot,
  players,
  isHost,
  onAssign,
  onRandomize,
}: TeamAssignmentPanelProps) {
  if (!snapshot) {
    return (
      <div
        className="rounded-xl border border-dashed border-wanas-border p-3 text-xs text-wanas-text-muted"
        data-testid="team-assignment-pending"
      >
        جاري تجهيز توزيع الفرق...
      </div>
    );
  }

  const byId = new Map(players.map((player) => [player.id, player]));
  const blue = snapshot.assignments
    .filter((entry) => entry.teamId === 'blue')
    .sort((a, b) => a.seat - b.seat)
    .map((entry) => byId.get(entry.playerId))
    .filter(Boolean) as LobbyPlayer[];
  const red = snapshot.assignments
    .filter((entry) => entry.teamId === 'red')
    .sort((a, b) => a.seat - b.seat)
    .map((entry) => byId.get(entry.playerId))
    .filter(Boolean) as LobbyPlayer[];
  const unassigned = snapshot.unassignedPlayerIds
    .map((id) => byId.get(id))
    .filter(Boolean) as LobbyPlayer[];

  return (
    <div className="space-y-3" data-testid="team-assignment-panel" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-wanas-text-secondary">توزيع الفرق</p>
        {isHost ? (
          <button
            type="button"
            data-testid="team-randomize"
            onClick={onRandomize}
            className="rounded-lg border border-wanas-border bg-wanas-surface-soft px-2.5 py-1 text-[11px] font-semibold text-wanas-text-primary"
          >
            توزيع عشوائي
          </button>
        ) : (
          <span className="text-[11px] text-wanas-text-muted">عرض فقط</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TeamColumn
          title="الفريق الأزرق"
          tone="blue"
          members={blue}
          capacity={snapshot.capacityPerTeam}
          isHost={isHost}
          otherTeam="red"
          onMove={(playerId) => onAssign(playerId, 'red')}
        />
        <TeamColumn
          title="الفريق الأحمر"
          tone="red"
          members={red}
          capacity={snapshot.capacityPerTeam}
          isHost={isHost}
          otherTeam="blue"
          onMove={(playerId) => onAssign(playerId, 'blue')}
        />
      </div>

      {unassigned.length > 0 ? (
        <div className="rounded-xl border border-wanas-border bg-wanas-surface-soft p-3" data-testid="team-unassigned">
          <p className="text-xs font-semibold text-wanas-text-secondary">بدون فريق</p>
          <ul className="mt-2 space-y-1.5">
            {unassigned.map((player) => (
              <li
                key={player.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-wanas-border/70 px-2.5 py-1.5"
              >
                <span className="text-xs font-semibold text-wanas-text-primary">{player.name}</span>
                {isHost ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      data-testid={`team-assign-blue-${player.id}`}
                      className="rounded-md border border-sky-400/40 px-2 py-0.5 text-[10px] font-semibold"
                      onClick={() => onAssign(player.id, 'blue')}
                    >
                      أزرق
                    </button>
                    <button
                      type="button"
                      data-testid={`team-assign-red-${player.id}`}
                      className="rounded-md border border-rose-400/40 px-2 py-0.5 text-[10px] font-semibold"
                      onClick={() => onAssign(player.id, 'red')}
                    >
                      أحمر
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
