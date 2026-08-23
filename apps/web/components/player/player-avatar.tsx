'use client';

import Image from 'next/image';
import { getDefaultPlayerAvatarId, type PlayerAvatarId } from '@wanasatna/shared';
import { useOptionalRoom } from '@/contexts/room-context';
import { getPlayerAvatarSrc } from '@/lib/avatars/catalog';
import { cn } from '@/lib/utils';

type PlayerAvatarProps = {
  playerId: string;
  avatarId?: PlayerAvatarId;
  playerName?: string;
  className?: string;
  sizes?: string;
};

export function PlayerAvatar({
  playerId,
  avatarId,
  playerName,
  className,
  sizes = '48px',
}: PlayerAvatarProps) {
  const room = useOptionalRoom();
  const resolvedAvatarId =
    avatarId ??
    room?.players.find((player) => player.id === playerId)?.avatarId ??
    getDefaultPlayerAvatarId(playerId);

  return (
    <Image
      src={getPlayerAvatarSrc(resolvedAvatarId)}
      alt={playerName ? `صورة ${playerName}` : ''}
      width={256}
      height={256}
      sizes={sizes}
      className={cn(
        'border-wanas-border aspect-square shrink-0 rounded-full border bg-white object-cover',
        className,
      )}
    />
  );
}
