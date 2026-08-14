'use client';

import type { DrawGuessDrawerMode } from '@wanasatna/shared';
import { cn } from '@/lib/utils';

export type DrawGuessLobbyPlayerOption = {
  id: string;
  name: string;
};

type DrawGuessSettingsPanelProps = {
  drawerMode: DrawGuessDrawerMode;
  fixedPlayerId: string | null;
  players: readonly DrawGuessLobbyPlayerOption[];
  isHost: boolean;
  onDrawerModeChange: (mode: DrawGuessDrawerMode) => void;
  onFixedPlayerChange: (playerId: string) => void;
};

const MODES: Array<{ id: DrawGuessDrawerMode; label: string; hint: string }> = [
  { id: 'random', label: 'عشوائي', hint: 'الرسام يُختار عشوائياً كل جولة' },
  { id: 'fixed', label: 'لاعب محدد', hint: 'نفس اللاعب يرسم الجولات الثلاث' },
];

export function DrawGuessSettingsPanel({
  drawerMode,
  fixedPlayerId,
  players,
  isHost,
  onDrawerModeChange,
  onFixedPlayerChange,
}: DrawGuessSettingsPanelProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-wanas-text-secondary">اختيار الرسام</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MODES.map((entry) => {
          const selected = drawerMode === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              disabled={!isHost}
              data-testid={`dg-lobby-drawer-${entry.id}`}
              onClick={() => {
                if (!isHost) {
                  return;
                }
                onDrawerModeChange(entry.id);
                if (entry.id === 'fixed' && !fixedPlayerId && players[0]) {
                  onFixedPlayerChange(players[0].id);
                }
              }}
              className={cn(
                'min-h-11 rounded-xl border px-3 py-3 text-start transition-colors',
                selected
                  ? 'border-wanas-accent bg-wanas-accent/10'
                  : 'border-wanas-border bg-wanas-surface-soft',
                !isHost && 'cursor-default opacity-80',
              )}
            >
              <p className="text-sm font-bold text-wanas-text-primary">{entry.label}</p>
              <p className="mt-1 text-[11px] text-wanas-text-muted">{entry.hint}</p>
            </button>
          );
        })}
      </div>

      {drawerMode === 'fixed' ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-wanas-text-muted">اختر الرسام</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {players.map((player) => {
              const selected = fixedPlayerId === player.id;
              return (
                <button
                  key={player.id}
                  type="button"
                  disabled={!isHost}
                  data-testid={`dg-lobby-fixed-${player.id}`}
                  onClick={() => {
                    if (!isHost) {
                      return;
                    }
                    onFixedPlayerChange(player.id);
                  }}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-start text-sm font-semibold transition-colors',
                    selected
                      ? 'border-wanas-accent bg-wanas-accent/10 text-wanas-text-primary'
                      : 'border-wanas-border bg-wanas-surface-soft text-wanas-text-secondary',
                    !isHost && 'cursor-default opacity-80',
                  )}
                >
                  {player.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
