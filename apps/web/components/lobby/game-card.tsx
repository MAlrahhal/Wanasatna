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
    'group relative flex h-full flex-col rounded-xl border bg-wanas-surface-soft p-3 text-center transition-colors duration-200',
    isLobbyCard && !isDisabled && 'hover:border-wanas-accent/35 hover:bg-wanas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/30',
    isLobbyCard && isDisabled && 'cursor-not-allowed opacity-70',
    isShowcaseCard && !isComingSoon && ['cursor-default hover:-translate-y-1 hover:shadow-lg', hoverBorderClassName],
    isShowcaseCard && isComingSoon && 'cursor-default opacity-75',
    selected
      ? 'border-wanas-accent ring-1 ring-wanas-accent/25'
      : isLobbyCard
        ? 'border-wanas-border'
        : 'border-wanas-border-muted',
  );

  const cardContent = (
    <>
      {selected ? (
        <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-wanas-accent px-2 py-0.5 text-[9px] font-bold text-[color:var(--wanas-background)]">
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
          'mx-auto mb-2 flex size-10 items-center justify-center rounded-full text-lg leading-none transition-colors',
          iconClassName,
          !isDisabled && 'group-hover:text-wanas-accent',
        )}
        style={
          iconBg && iconText
            ? { backgroundColor: iconBg, color: iconText }
            : undefined
        }
      >
        {game.emoji}
      </div>

      <h3 className="text-xs font-bold text-wanas-text-primary sm:text-sm">{game.title}</h3>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-wanas-text-muted">
        {game.description}
      </p>
      {playerRange ? (
        <p className="mt-2 text-[10px] font-medium text-wanas-text-subtle">{playerRange}</p>
      ) : null}
    </>
  );

  if (isShowcaseCard) {
    return <article className={cardClassName}>{cardContent}</article>;
  }

  return (
    <button type="button" disabled={isDisabled} onClick={() => onSelect(game.id)} className={cardClassName}>
      {cardContent}
    </button>
  );
}
