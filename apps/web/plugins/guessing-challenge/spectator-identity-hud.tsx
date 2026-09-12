'use client';

import type {
  GuessingChallengeSpectatorTeamView,
  GuessingChallengeVisibleIdentity,
} from '@wanasatna/shared';
import { cn } from '@/lib/utils';

type SpectatorTeams = Record<'blue' | 'red', GuessingChallengeSpectatorTeamView>;

export type SpectatorIdentityHudItem = {
  teamId: 'blue' | 'red';
  side: 'left' | 'right';
  label: string;
  identity: GuessingChallengeVisibleIdentity;
};

export function spectatorIdentityHudItems(teams: SpectatorTeams): SpectatorIdentityHudItem[] {
  return [
    {
      teamId: 'blue',
      side: 'left',
      label: 'هوية الأزرق',
      identity: teams.blue.identity,
    },
    {
      teamId: 'red',
      side: 'right',
      label: 'هوية الأحمر',
      identity: teams.red.identity,
    },
  ];
}

export function GuessingChallengeSpectatorIdentityHud({
  teams,
  className,
}: {
  teams: SpectatorTeams;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-2 top-2 z-10 grid grid-cols-2 gap-2 sm:inset-x-5 sm:top-4 sm:gap-4',
        className,
      )}
      data-testid="gc-spectator-identity-hud"
      data-readonly="true"
      dir="ltr"
    >
      {spectatorIdentityHudItems(teams).map((item) => (
        <SpectatorIdentityDisplay key={item.teamId} item={item} />
      ))}
    </div>
  );
}

function SpectatorIdentityDisplay({ item }: { item: SpectatorIdentityHudItem }) {
  const value = item.identity.value?.trim() || (item.identity.type === 'image' ? 'صورة' : '—');
  const hasImage = item.identity.type === 'image' && Boolean(item.identity.imageUrl);

  return (
    <div
      className={cn(
        'flex min-h-14 w-full min-w-0 max-w-44 items-center gap-2 rounded-xl border bg-slate-950/90 px-2.5 py-2 shadow-[0_10px_22px_rgba(0,0,0,0.4)] backdrop-blur-sm sm:max-w-56 sm:px-3',
        item.side === 'left' ? 'justify-self-start' : 'justify-self-end',
        item.teamId === 'blue'
          ? 'border-sky-300/60 text-sky-50'
          : 'border-rose-300/60 text-rose-50',
      )}
      data-testid={`gc-spectator-${item.teamId}-identity-hud`}
      data-team={item.teamId}
      data-side={item.side}
      data-identity-type={item.identity.type}
      dir="rtl"
      aria-label={`${item.label}: ${value}`}
    >
      {hasImage ? (
        <img
          src={item.identity.imageUrl!}
          alt={value === 'صورة' ? item.label : value}
          className="h-9 w-9 shrink-0 rounded-lg border border-white/20 bg-white/10 object-contain sm:h-10 sm:w-10"
          data-testid={`gc-spectator-${item.teamId}-identity-hud-image`}
        />
      ) : (
        <span
          className={cn(
            'h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]',
            item.teamId === 'blue' ? 'bg-sky-400 text-sky-400' : 'bg-rose-400 text-rose-400',
          )}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[0.6rem] font-bold sm:text-[0.68rem]',
            item.teamId === 'blue' ? 'text-sky-200' : 'text-rose-200',
          )}
          data-testid={`gc-spectator-${item.teamId}-identity-hud-label`}
        >
          {item.label}
        </p>
        <p
          className="mt-0.5 line-clamp-2 break-words text-xs font-extrabold leading-4 [overflow-wrap:anywhere] sm:text-sm sm:leading-5"
          data-testid={`gc-spectator-${item.teamId}-identity-hud-value`}
          dir="auto"
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
