'use client';

import { useRef, useState } from 'react';
import { MAX_ROOM_PLAYERS } from '@wanasatna/shared';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { UiDialog } from '@/components/ui/dialog';
import { LobbyPanel } from './lobby-ui';
import { PlayerCard } from './player-card';

type PlayersPanelProps = {
  players: LobbyPlayer[];
  currentPlayerId?: string | null;
  isHost: boolean;
  onKickPlayer?: (playerId: string) => void;
  activeMatchParticipantIds?: string[] | null;
  hasActiveMatch?: boolean;
  playerCap?: number;
  onChangeAvatar?: () => void;
};

export function PlayersPanel({
  players,
  currentPlayerId,
  isHost,
  onKickPlayer,
  activeMatchParticipantIds = null,
  hasActiveMatch = false,
  playerCap = MAX_ROOM_PLAYERS,
  onChangeAvatar,
}: PlayersPanelProps) {
  const participantSet = new Set(activeMatchParticipantIds ?? []);
  const [kickTarget, setKickTarget] = useState<LobbyPlayer | null>(null);
  const kickingRef = useRef(false);

  function handleConfirmKick() {
    if (!kickTarget || kickingRef.current) {
      return;
    }
    kickingRef.current = true;
    onKickPlayer?.(kickTarget.id);
    kickingRef.current = false;
    setKickTarget(null);
  }

  return (
    <LobbyPanel
      title="اللاعبون"
      description={
        <span dir="ltr" className="inline-block tabular-nums tracking-wide">
          {players.length} / {playerCap}
        </span>
      }
      className="h-fit max-h-[min(70vh,720px)] xl:max-h-[calc(100vh-220px)]"
      bodyClassName="min-h-0 gap-2 p-2.5 sm:p-4"
    >
      <div className="flex max-h-[min(58vh,600px)] flex-col gap-2 overflow-y-auto overscroll-contain xl:max-h-[min(70vh,640px)]">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            isCurrentPlayer={player.id === currentPlayerId}
            canKick={isHost}
            onKick={() => setKickTarget(player)}
            onAvatarClick={
              player.id === currentPlayerId && !hasActiveMatch ? onChangeAvatar : undefined
            }
            isWaitingForNextMatch={
              hasActiveMatch && activeMatchParticipantIds !== null && !participantSet.has(player.id)
            }
          />
        ))}
      </div>

      <p className="text-wanas-text-muted mt-1 text-center text-[11px] leading-5">
        دعوة الأصدقاء غير متاحة حالياً.
      </p>

      <UiDialog
        open={Boolean(kickTarget)}
        title="طرد اللاعب؟"
        description={`هل أنت متأكد أنك تريد طرد ${kickTarget?.name ?? ''} من الغرفة؟`}
        variant="warning"
        confirmLabel="طرد"
        cancelLabel="إلغاء"
        onClose={() => {
          if (!kickingRef.current) {
            setKickTarget(null);
          }
        }}
        onConfirm={handleConfirmKick}
      />
    </LobbyPanel>
  );
}
