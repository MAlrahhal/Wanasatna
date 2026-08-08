import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type LobbyPanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  variant?: 'lobby' | 'game';
};

export function LobbyPanel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  headerClassName,
  variant = 'lobby',
}: LobbyPanelProps) {
  const isGame = variant === 'game';

  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-wanas-border bg-wanas-surface shadow-[var(--wanas-shadow-panel)]',
        isGame && 'wanas-game-card',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-start justify-between gap-2 border-b border-wanas-border px-4 py-3',
          headerClassName,
        )}
      >
        <div className="min-w-0">
          <h2 className={cn('text-wanas-text-primary', isGame ? 'wanas-game-title' : 'text-sm font-bold sm:text-base')}>
            {title}
          </h2>
          {description ? (
            <p className={cn('mt-1', isGame ? 'wanas-game-helper' : 'text-xs text-wanas-text-muted')}>
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className={cn('flex flex-col p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function LobbyStateCard({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
      <div className="wanas-panel w-full max-w-md border-t-2 border-t-wanas-accent p-6 text-center sm:p-7">
        {icon ? (
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-wanas-primary-surface text-wanas-primary-dark">
            {icon}
          </div>
        ) : null}
        <h1 className="text-xl font-bold text-wanas-text-primary">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-7 text-wanas-text-muted">{description}</p> : null}
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}

const avatarPalette = [
  { bg: 'var(--wanas-primary-surface-strong)', text: 'var(--wanas-primary-dark)' },
  { bg: 'var(--wanas-game-orange-surface-strong)', text: 'var(--wanas-game-orange-dark)' },
  { bg: 'var(--wanas-game-rose-icon-bg)', text: 'var(--wanas-game-rose-icon-text)' },
  { bg: 'var(--wanas-game-teal-icon-bg)', text: 'var(--wanas-game-teal-icon-text)' },
  { bg: 'var(--wanas-game-purple-surface-strong)', text: 'var(--wanas-game-purple-dark)' },
  { bg: 'var(--wanas-success-surface)', text: 'var(--wanas-success-text)' },
] as const;

export function getPlayerAvatarColors(playerId: string) {
  let hash = 0;
  for (let index = 0; index < playerId.length; index += 1) {
    hash = (hash + playerId.charCodeAt(index)) % avatarPalette.length;
  }
  return avatarPalette[hash] ?? avatarPalette[0];
}

const playerAvatarEmojis = ['😎', '🤖', '🎮', '🚀', '🔥', '⚡', '🎯', '🦊', '🐧', '🐱'] as const;

export function getPlayerAvatarEmoji(playerId: string): string {
  let hash = 0;
  for (let index = 0; index < playerId.length; index += 1) {
    hash = (hash + playerId.charCodeAt(index)) % playerAvatarEmojis.length;
  }
  return playerAvatarEmojis[hash] ?? playerAvatarEmojis[0];
}
