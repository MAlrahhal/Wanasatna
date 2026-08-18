import Link from 'next/link';
import { isPlayableGameId } from '@wanasatna/shared';
import type { LobbyGame } from '@/lib/lobby/types';
import { usePlayableGameAvailability } from '@/lib/games/use-game-availability';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { getGameInformationPath } from '@/lib/public/routes';
import { getHomeRoomActionsHref } from '@/lib/public/scroll-to-room-actions';
import { StatusBadge } from '@/components/public/status-badge';
import { cn } from '@/lib/utils';

type GamePreviewCardProps = {
  game: LobbyGame;
  className?: string;
};

export function GamePreviewCard({ game, className }: GamePreviewCardProps) {
  const entry = getGameCatalogEntry(game.id);
  const { isGameEnabled } = usePlayableGameAvailability();
  const runtimeEnabled = isGameEnabled(game.id);
  const isComingSoon = entry.availability === 'coming-soon';
  const isAvailable = !isComingSoon && runtimeEnabled;
  const badgeVariant = isComingSoon ? 'coming-soon' : isAvailable ? 'available' : 'unavailable';

  return (
    <article
      className={cn(
        'wanas-interactive-card group relative flex h-full flex-col overflow-hidden p-4',
        isAvailable
          ? 'border-t-2 border-t-wanas-accent'
          : 'border-wanas-border-muted opacity-75 hover:translate-y-0 hover:shadow-[var(--wanas-shadow-card)]',
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div
          className="flex size-11 items-center justify-center rounded-[var(--wanas-radius-control)] text-base font-bold transition-transform group-hover:-rotate-3 group-hover:scale-105"
          style={{ backgroundColor: entry.iconBg, color: entry.iconText }}
        >
          {game.iconLabel}
        </div>
        <StatusBadge variant={badgeVariant} />
      </div>
      <h3 className="text-base font-bold text-wanas-text-primary">{game.title}</h3>
      <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-6 text-wanas-text-muted">{game.description}</p>
      <p className="mt-3 text-xs font-medium text-wanas-text-subtle">{entry.playerRange}</p>
    </article>
  );
}

type GameCatalogCardProps = {
  game: LobbyGame;
};

export function GameCatalogCard({ game }: GameCatalogCardProps) {
  const entry = getGameCatalogEntry(game.id);
  const { isGameEnabled } = usePlayableGameAvailability();
  const runtimeEnabled = isGameEnabled(game.id);
  const isComingSoon = entry.availability === 'coming-soon';
  const isAvailable = !isComingSoon && runtimeEnabled;
  const badgeVariant = isComingSoon ? 'coming-soon' : isAvailable ? 'available' : 'unavailable';

  const content = (
    <>
      <div className="relative mb-5 flex items-start justify-between gap-3">
        <div
          className="flex size-14 items-center justify-center rounded-[18px] text-lg font-bold shadow-sm"
          style={{ backgroundColor: entry.iconBg, color: entry.iconText }}
        >
          {game.iconLabel}
        </div>
        <StatusBadge variant={badgeVariant} />
      </div>
      <h3 className="relative text-lg font-bold text-wanas-text-primary">{game.title}</h3>
      <p className="relative mt-2 text-sm leading-7 text-wanas-text-muted">{game.description}</p>
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-wanas-background pt-4">
        <span className="text-xs font-semibold text-wanas-text-muted">{entry.playerRange}</span>
        <div className="flex flex-wrap items-center gap-2">
          {isPlayableGameId(game.id) ? (
            <Link
              href={getGameInformationPath(game.id)}
              aria-label={`اعرف أكثر عن ${game.title}`}
              className="inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs font-bold text-wanas-primary-dark underline-offset-2 hover:underline"
            >
              اعرف أكثر
            </Link>
          ) : null}
          {isAvailable ? (
            <Link
              href={getHomeRoomActionsHref()}
              aria-label={`العب ${game.title} الآن`}
              className="inline-flex min-h-11 items-center rounded-full bg-wanas-primary-surface px-3 py-1.5 text-xs font-bold text-wanas-primary-dark transition-colors hover:bg-wanas-primary-surface-strong"
            >
              العب الآن
            </Link>
          ) : (
            <span className="text-xs font-semibold text-wanas-text-subtle">
              {isComingSoon ? 'قريباً' : 'غير متاحة حالياً'}
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (isAvailable) {
    return (
      <article
        className={cn(
          'wanas-interactive-card group relative overflow-hidden border-t-2 border-t-wanas-accent p-5',
        )}
      >
        {content}
      </article>
    );
  }

  return (
    <article className="relative overflow-hidden rounded-[var(--wanas-radius-card)] border border-wanas-border-muted bg-wanas-surface-soft p-5 opacity-75">
      {content}
    </article>
  );
}
