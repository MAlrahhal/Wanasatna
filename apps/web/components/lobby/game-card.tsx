import type { HomeGameAvailability } from '@/lib/home/game-showcase';
import type { LobbyGame } from '@/lib/lobby/types';
import { StatusBadge } from '@/components/public/status-badge';
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
  const isComingSoon = availability === 'coming-soon';
  const isDisabled = disabled || isComingSoon;
  const isShowcaseCard = showcase && availability !== undefined;
  const isLobbyCard = !showcase;

  const cardClassName = cn(
    'group relative flex h-full min-h-[168px] flex-col rounded-xl border p-3 text-center transition-colors duration-200',
    selected ? 'border-wanas-accent bg-wanas-accent/10' : 'bg-wanas-surface-soft',
    isLobbyCard && !isDisabled && !selected && 'hover:border-wanas-accent/35 hover:bg-wanas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/30',
    isLobbyCard && isDisabled && 'cursor-default',
    isShowcaseCard && !isComingSoon && ['cursor-default hover:-translate-y-1 hover:shadow-lg', hoverBorderClassName],
    isShowcaseCard && isComingSoon && 'cursor-default opacity-75',
    !selected && (isLobbyCard ? 'border-wanas-border' : 'border-wanas-border-muted'),
  );

  const cardContent = (
    <>
      {selected ? (
        <span className="absolute start-2 top-2 inline-flex items-center rounded-full border border-wanas-accent bg-wanas-accent px-2 py-0.5 text-[11px] font-bold text-white">
          ✓ مختارة
        </span>
      ) : null}

      {availability && !selected ? (
        <span className="absolute start-2 top-2">
          <StatusBadge variant={isComingSoon ? 'coming-soon' : 'available'} />
        </span>
      ) : null}

      <div
        className={cn(
          'mx-auto mb-2 flex size-12 items-center justify-center rounded-full text-2xl leading-none',
          iconClassName,
        )}
        style={
          iconBg && iconText
            ? { backgroundColor: iconBg, color: iconText }
            : undefined
        }
        aria-hidden
      >
        {game.emoji}
      </div>

      <h3 className="min-h-10 text-sm font-bold leading-5 text-wanas-text-primary">{game.title}</h3>
      <p className="mt-1 line-clamp-2 min-h-8 flex-1 text-xs leading-4 text-wanas-text-muted">
        {game.description}
      </p>
      {playerRange ? (
        <p className="mt-2 text-[11px] font-medium text-wanas-text-subtle">{playerRange}</p>
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
