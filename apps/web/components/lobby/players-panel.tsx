import type { LobbyPlayer } from '@/lib/lobby/types';
import { PlayerCard } from './player-card';

type PlayersPanelProps = {
  players: LobbyPlayer[];
  isHost: boolean;
  onKickPlayer?: (playerId: string) => void;
};

export function PlayersPanel({ players, isHost, onKickPlayer }: PlayersPanelProps) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">اللاعبون</h2>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {players.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            canKick={isHost}
            onKick={onKickPlayer}
          />
        ))}
      </div>
    </section>
  );
}
