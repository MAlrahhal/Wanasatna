import type { HomeGameAvailability } from '@/lib/home/game-showcase';
import type { LobbyGame } from '@/lib/lobby/types';
import { StatusBadge } from '@/components/public/status-badge';
import { GameArtwork } from '@/components/game/game-artwork';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { cn } from '@/lib/utils';

type GameCardProps = {
  game: LobbyGame;
  selected: boolean;
  disabled?: boolean;
  onSelect: (gameId: string) => void;
  availability?: HomeGameAvailability;
  iconBg?: string;
  iconText?: string;
  playerRange?: string;
  showcase?: boolean;
  iconClassName?: string;
  hoverBorderClassName?: string;
};

export function GameCard({
  game,
  selected,
  disabled = false,
  onSelect,
  availability,
  iconBg,
  iconText,
  playerRange,
  showcase = false,
  iconClassName,
  hoverBorderClassName,
}: GameCardProps) {
  const imagePath = getGameCatalogEntry(game.id).imagePath;
  const isComingSoon = availability === 'coming-soon';
  const isUnavailable = availability === 'unavailable';
  const isDisabled = disabled || isComingSoon || isUnavailable;
  const isShowcaseCard = showcase && availability !== undefined;
  const isLobbyCard = !showcase;

  const cardClassName = cn(
    'group relative flex h-full flex-col rounded-xl border text-center transition-colors duration-200',
    isShowcaseCard ? 'min-h-[168px] p-3' : 'min-h-0 p-2.5 xl:min-h-[168px] xl:p-3',
    selected
      ? 'border-wanas-accent bg-wanas-accent/10 ring-2 ring-wanas-accent'
      : 'bg-wanas-surface-soft',
    isLobbyCard &&
      !isDisabled &&
      !selected &&
      'hover:border-wanas-accent/35 hover:bg-wanas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/30',
    isLobbyCard && isDisabled && 'cursor-default',
    isShowcaseCard &&
      !isComingSoon &&
      !isUnavailable && [
        'cursor-default hover:-translate-y-1 hover:shadow-lg',
        hoverBorderClassName,
      ],
    isShowcaseCard && isComingSoon && 'cursor-default opacity-75',
    isShowcaseCard && isUnavailable && 'cursor-default opacity-75',
    !selected && (isLobbyCard ? 'border-wanas-border' : 'border-wanas-border-muted'),
  );

  const cardContent = (
    <>
      {selected ? (
        <span className="border-wanas-accent bg-wanas-accent absolute start-2 top-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold text-white">
          ✓ مختارة
        </span>
      ) : null}

      {availability && !selected ? (
        <span className="absolute start-2 top-2">
          <StatusBadge
            variant={isComingSoon ? 'coming-soon' : isUnavailable ? 'unavailable' : 'available'}
          />
        </span>
      ) : null}

      {imagePath ? (
        <div
          className={cn(
            'mx-auto mb-1.5 shrink-0 xl:mb-2',
            isShowcaseCard ? 'size-16' : 'size-14 xl:size-16',
            iconClassName,
          )}
        >
          <GameArtwork src={imagePath} sizes="64px" />
        </div>
      ) : (
        <div
          className={cn(
            'mx-auto mb-1.5 flex items-center justify-center rounded-full leading-none xl:mb-2',
            isShowcaseCard ? 'size-12 text-2xl' : 'size-10 text-xl xl:size-12 xl:text-2xl',
            iconClassName,
          )}
          style={iconBg && iconText ? { backgroundColor: iconBg, color: iconText } : undefined}
          aria-hidden
        >
          {game.emoji}
        </div>
      )}

      <h3
        className={cn(
          'text-wanas-text-primary font-bold leading-5',
          isShowcaseCard ? 'min-h-10 text-sm' : 'text-sm xl:min-h-10',
        )}
      >
        {game.title}
      </h3>
      <p
        className={cn(
          'text-wanas-text-muted mt-1 line-clamp-2 flex-1 leading-4',
          isShowcaseCard ? 'min-h-8 text-xs' : 'min-h-0 text-[11px] xl:min-h-8 xl:text-xs',
        )}
      >
        {game.description}
      </p>
      {playerRange ? (
        <p className="text-wanas-text-subtle mt-1.5 text-[11px] font-medium xl:mt-2">
          {playerRange}
        </p>
      ) : null}
    </>
  );

  if (isShowcaseCard) {
    return <article className={cardClassName}>{cardContent}</article>;
  }

  if (isDisabled) {
    return (
      <div className={cardClassName} aria-disabled="true">
        {cardContent}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(game.id)}
      className={cardClassName}
    >
      {cardContent}
    </button>
  );
}
