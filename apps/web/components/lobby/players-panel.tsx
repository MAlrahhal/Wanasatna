'use client';

import { useRef, useState } from 'react';
import { getDefaultPlayerAvatarId, MAX_ROOM_PLAYERS } from '@wanasatna/shared';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { UiDialog } from '@/components/ui/dialog';
import { LobbyPanel } from './lobby-ui';
import { AvatarPickerDialog } from './avatar-picker-dialog';
import { useRoom } from '@/contexts/room-context';
import { PlayerCard } from './player-card';

type PlayersPanelProps = {
  players: LobbyPlayer[];
  currentPlayerId?: string | null;
  isHost: boolean;
  onKickPlayer?: (playerId: string) => void;
  activeMatchParticipantIds?: string[] | null;
  hasActiveMatch?: boolean;
  playerCap?: number;
};

export function PlayersPanel({
  players,
  currentPlayerId,
  isHost,
  onKickPlayer,
  activeMatchParticipantIds = null,
  hasActiveMatch = false,
  playerCap = MAX_ROOM_PLAYERS,
}: PlayersPanelProps) {
  const participantSet = new Set(activeMatchParticipantIds ?? []);
  const [kickTarget, setKickTarget] = useState<LobbyPlayer | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const kickingRef = useRef(false);
  const { updatePlayerAvatar } = useRoom();
  const currentPlayer = players.find((player) => player.id === currentPlayerId) ?? null;

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
            onAvatarClick={player.id === currentPlayerId && !hasActiveMatch ? () => setAvatarPickerOpen(true) : undefined}
            isWaitingForNextMatch={
              hasActiveMatch && activeMatchParticipantIds !== null && !participantSet.has(player.id)
            }
          />
        ))}
      </div>

      <p className="mt-1 text-center text-[11px] leading-5 text-wanas-text-muted">
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

      {currentPlayer ? (
        <AvatarPickerDialog
          open={avatarPickerOpen}
          playerId={currentPlayer.id}
          playerName={currentPlayer.name}
          selectedAvatarId={currentPlayer.avatarId ?? getDefaultPlayerAvatarId(currentPlayer.id)}
          onClose={() => setAvatarPickerOpen(false)}
          onSelect={(avatarId) => {
            void updatePlayerAvatar(avatarId).then((success) => {
              if (success) setAvatarPickerOpen(false);
            });
          }}
        />
      ) : null}
    </LobbyPanel>
  );
}
