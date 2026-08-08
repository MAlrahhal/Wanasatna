import type { LobbyPlayer } from '@/lib/lobby/types';
import { getPlayerAvatarEmoji } from '@/components/lobby/lobby-ui';
import { cn } from '@/lib/utils';

type PlayerCardProps = {
  player: LobbyPlayer;
  isCurrentPlayer?: boolean;
  canKick?: boolean;
  onKick?: (playerId: string) => void;
  avatarColors: { bg: string; text: string };
  avatarEmoji?: string;
  isWaitingForNextMatch?: boolean;
};

export function PlayerCard({
  player,
  isCurrentPlayer = false,
  canKick = false,
  onKick,
  avatarColors,
  avatarEmoji,
  isWaitingForNextMatch = false,
}: PlayerCardProps) {
  const initial = player.name.charAt(0);
  const emoji = avatarEmoji ?? getPlayerAvatarEmoji(player.id);

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors',
        isCurrentPlayer
          ? 'border-wanas-accent/35 bg-wanas-accent/8'
          : 'border-wanas-border bg-wanas-surface-soft hover:border-wanas-border-strong',
      )}
    >
      <div className="relative shrink-0">
        <div
          className="flex size-9 items-center justify-center rounded-full text-xs font-semibold"
          style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
          aria-hidden
        >
          {initial}
        </div>
        <span
          className="absolute -bottom-0.5 -start-0.5 flex size-4 items-center justify-center rounded-full border border-wanas-border bg-wanas-surface text-[10px] leading-none"
          aria-hidden
        >
          {emoji}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-semibold text-wanas-text-primary sm:text-sm">{player.name}</p>
          {isCurrentPlayer ? (
            <span className="rounded-full bg-wanas-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-wanas-accent">
              أنت
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {player.isHost ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-wanas-warning-surface px-2 py-0.5 text-[9px] font-semibold text-wanas-warning-dark">
              <span aria-hidden>★</span>
              المضيف
            </span>
          ) : null}
          {player.isSpectator ? (
            <span className="rounded-full bg-wanas-surface-muted px-2 py-0.5 text-[9px] font-medium text-wanas-text-muted">
              متفرّج
            </span>
          ) : null}
          {isWaitingForNextMatch ? (
            <span className="rounded-full bg-wanas-surface-muted px-2 py-0.5 text-[9px] font-medium text-wanas-text-muted">
              بانتظار الجولة القادمة
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-wanas-success-dark">
            <span className="size-1.5 rounded-full bg-wanas-success" aria-hidden />
            متصل
          </span>
        </div>
      </div>

      {canKick && !player.isHost ? (
        <button
          type="button"
          aria-label={`طرد ${player.name}`}
          onClick={() => onKick?.(player.id)}
          className="min-h-9 rounded-lg border border-wanas-error-border px-2 py-1 text-[10px] font-semibold text-wanas-error transition-colors hover:bg-wanas-error-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-error/35"
        >
          طرد
        </button>
      ) : null}
    </div>
  );
}
