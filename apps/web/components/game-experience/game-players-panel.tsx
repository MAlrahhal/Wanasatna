'use client';

import { getPlayerAvatarColors } from '@/components/lobby/lobby-ui';
import { useGameShell } from '@/contexts/game-shell-context';
import { useRoom } from '@/contexts/room-context';
import { cn } from '@/lib/utils';

type GamePlayersPanelProps = {
  className?: string;
};

export function GamePlayersPanel({ className }: GamePlayersPanelProps) {
  const { players, player: currentPlayer } = useRoom();
  const { state: shellState } = useGameShell();

  const connectionById = new Map(
    (shellState?.players ?? []).map((shellPlayer) => [shellPlayer.id, shellPlayer.isConnected]),
  );

  return (
    <aside
      aria-label="اللاعبون"
      className={cn(
        'wanas-game-panel flex min-h-0 flex-col p-3 sm:p-4',
        className,
      )}
    >
      <h2 className="mb-3 text-xs font-semibold text-[color:var(--wanas-game-text-secondary)]">
        اللاعبون ({players.length})
      </h2>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {players.map((roomPlayer) => {
          const avatarColors = getPlayerAvatarColors(roomPlayer.id);
          const isCurrent = roomPlayer.id === currentPlayer?.id;
          const isConnected = connectionById.get(roomPlayer.id);

          return (
            <li
              key={roomPlayer.id}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border px-2.5 py-2',
                isCurrent
                  ? 'border-[color:var(--wanas-game-accent)] bg-[color:var(--wanas-game-accent-soft)]'
                  : 'border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)]',
              )}
            >
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
                aria-hidden
              >
                {roomPlayer.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[color:var(--wanas-game-text-primary)]">
                  {roomPlayer.name}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {roomPlayer.isHost ? (
                    <span className="rounded-full bg-[color:var(--wanas-game-warning)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      مضيف
                    </span>
                  ) : null}
                  {isCurrent ? (
                    <span className="rounded-full bg-[color:var(--wanas-game-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      أنت
                    </span>
                  ) : null}
                  {roomPlayer.isSpectator ? (
                    <span className="rounded-full border border-[color:var(--wanas-game-panel-border)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--wanas-game-text-secondary)]">
                      متفرّج
                    </span>
                  ) : null}
                  {isConnected === false ? (
                    <span className="rounded-full bg-[color:var(--wanas-game-danger)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--wanas-game-danger)]">
                      غير متصل
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
