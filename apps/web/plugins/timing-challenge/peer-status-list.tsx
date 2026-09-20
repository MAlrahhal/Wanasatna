'use client';

import type { TimingChallengePeerStatus } from '@wanasatna/shared';
import { AdPlacement } from '@/components/ads/ad-placement';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<TimingChallengePeerStatus['status'], string> = {
  waiting: 'بانتظار',
  ready: 'جاهز ✅',
  running: 'يحاول الآن',
  done: 'انتهى ✅',
};

export function PeerStatusList({
  peers,
  currentPlayerId,
}: {
  peers: readonly TimingChallengePeerStatus[];
  currentPlayerId: string;
}) {
  return (
    <div className="space-y-4" data-game-player-list="timing-challenge">
      <ul className="space-y-1.5">
        {peers.map((peer) => (
          <li
            key={peer.playerId}
            className={cn(
              'border-wanas-border bg-wanas-surface-soft flex items-center justify-between rounded-lg border px-3 py-2 text-xs',
              peer.playerId === currentPlayerId && 'border-wanas-accent/40',
            )}
          >
            <span className="text-wanas-text-primary font-semibold">{peer.name}</span>
            <span className="text-wanas-text-muted">{STATUS_LABEL[peer.status]}</span>
          </li>
        ))}
      </ul>
      <AdPlacement placement="game-player-list" />
    </div>
  );
}
