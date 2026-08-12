import { MAX_ROOM_PLAYERS } from '@wanasatna/shared';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { getPlayerAvatarColors, getPlayerAvatarEmoji, LobbyPanel } from './lobby-ui';
import { PlayerCard } from './player-card';

type PlayersPanelProps = {
  players: LobbyPlayer[];
  currentPlayerId?: string | null;
  isHost: boolean;
  onKickPlayer?: (playerId: string) => void;
  activeMatchParticipantIds?: string[] | null;
  hasActiveMatch?: boolean;
};

export function PlayersPanel({
  players,
  currentPlayerId,
  isHost,
  onKickPlayer,
  activeMatchParticipantIds = null,
  hasActiveMatch = false,
}: PlayersPanelProps) {
  const participantSet = new Set(activeMatchParticipantIds ?? []);

  return (
    <LobbyPanel
      title="اللاعبون"
      description={`${players.length} / ${MAX_ROOM_PLAYERS}`}
      className="h-fit"
      bodyClassName="gap-2 p-3 sm:p-4"
    >
      <div className="flex flex-col gap-2">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            isCurrentPlayer={player.id === currentPlayerId}
            canKick={isHost}
            onKick={onKickPlayer}
            avatarColors={getPlayerAvatarColors(player.id)}
            avatarEmoji={getPlayerAvatarEmoji(player.id)}
            isWaitingForNextMatch={
              hasActiveMatch && activeMatchParticipantIds !== null && !participantSet.has(player.id)
            }
          />
        ))}
      </div>

      <button
        type="button"
        disabled
        aria-disabled="true"
        className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-wanas-border bg-wanas-surface-soft text-xs font-semibold text-wanas-text-muted disabled:cursor-not-allowed"
      >
        <span aria-hidden>＋</span>
        دعوة أصدقاء
      </button>
    </LobbyPanel>
  );
}
