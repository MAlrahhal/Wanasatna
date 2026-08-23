import Link from 'next/link';
import { isPlayableGameId } from '@wanasatna/shared';
import type { LobbyGame } from '@/lib/lobby/types';
import { usePlayableGameAvailability } from '@/lib/games/use-game-availability';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { getGameInformationPath } from '@/lib/public/routes';
import { getHomeRoomActionsHref } from '@/lib/public/scroll-to-room-actions';
import { StatusBadge } from '@/components/public/status-badge';
import { GameArtwork } from '@/components/game/game-artwork';
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
          ? 'border-t-wanas-accent border-t-2'
          : 'border-wanas-border-muted opacity-75 hover:translate-y-0 hover:shadow-[var(--wanas-shadow-card)]',
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        {entry.imagePath ? (
          <div className="size-16 shrink-0 transition-transform group-hover:-rotate-3 group-hover:scale-105">
            <GameArtwork src={entry.imagePath} sizes="64px" />
          </div>
        ) : (
          <div
            className="flex size-11 items-center justify-center rounded-[var(--wanas-radius-control)] text-base font-bold"
            style={{ backgroundColor: entry.iconBg, color: entry.iconText }}
          >
            {game.iconLabel}
          </div>
        )}
        <StatusBadge variant={badgeVariant} />
      </div>
      <h3 className="text-wanas-text-primary text-base font-bold">{game.title}</h3>
      <p className="text-wanas-text-muted mt-1.5 line-clamp-2 flex-1 text-sm leading-6">
        {game.description}
      </p>
      <p className="text-wanas-text-subtle mt-3 text-xs font-medium">{entry.playerRange}</p>
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
        {entry.imagePath ? (
          <div className="size-20 shrink-0 transition-transform group-hover:-rotate-3 group-hover:scale-105">
            <GameArtwork src={entry.imagePath} sizes="80px" />
          </div>
        ) : (
          <div
            className="flex size-14 items-center justify-center rounded-[18px] text-lg font-bold shadow-sm"
            style={{ backgroundColor: entry.iconBg, color: entry.iconText }}
          >
            {game.iconLabel}
          </div>
        )}
        <StatusBadge variant={badgeVariant} />
      </div>
      <h3 className="text-wanas-text-primary relative text-lg font-bold">{game.title}</h3>
      <p className="text-wanas-text-muted relative mt-2 text-sm leading-7">{game.description}</p>
      <div className="border-wanas-background relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span className="text-wanas-text-muted text-xs font-semibold">{entry.playerRange}</span>
        <div className="flex flex-wrap items-center gap-2">
          {isPlayableGameId(game.id) ? (
            <Link
              href={getGameInformationPath(game.id)}
              aria-label={`اعرف أكثر عن ${game.title}`}
              className="text-wanas-primary-dark inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs font-bold underline-offset-2 hover:underline"
            >
              اعرف أكثر
            </Link>
          ) : null}
          {isAvailable ? (
            <Link
              href={getHomeRoomActionsHref()}
              aria-label={`العب ${game.title} الآن`}
              className="bg-wanas-primary-surface text-wanas-primary-dark hover:bg-wanas-primary-surface-strong inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
            >
              العب الآن
            </Link>
          ) : (
            <span className="text-wanas-text-subtle text-xs font-semibold">
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
          'wanas-interactive-card border-t-wanas-accent group relative overflow-hidden border-t-2 p-5',
        )}
      >
        {content}
      </article>
    );
  }

  return (
    <article className="border-wanas-border-muted bg-wanas-surface-soft relative overflow-hidden rounded-[var(--wanas-radius-card)] border p-5 opacity-75">
      {content}
    </article>
  );
}
