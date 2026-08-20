'use client';

import type { LobbyGame, LobbyGameSettingsPlaceholder } from '@/lib/lobby/types';
import { GameSettingsPanel } from './game-settings-panel';
import { RoundCategoryPanel } from './round-category-panel';

type LobbySelectedGameSetupProps = {
  selectedGameId: string | null;
  selectedGame: LobbyGame | null;
  selectedGameSettings: LobbyGameSettingsPlaceholder[];
  selectedRoundCategoryId: string | null;
  isHost: boolean;
  isWaitingForNextMatch: boolean;
  onSelectCategory: (categoryId: string) => void;
};

/** Single keyed slot: only the currently selected game's category + settings UI. */
export function LobbySelectedGameSetup({
  selectedGameId,
  selectedGame,
  selectedGameSettings,
  selectedRoundCategoryId,
  isHost,
  isWaitingForNextMatch,
  onSelectCategory,
}: LobbySelectedGameSetupProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-lobby-selected-game={selectedGameId ?? ''}>
      <RoundCategoryPanel
        gameId={selectedGameId}
        selectedCategoryId={selectedRoundCategoryId}
        isHost={isHost}
        isActiveMatch={isWaitingForNextMatch}
        onSelectCategory={onSelectCategory}
      />
      <GameSettingsPanel
        selectedGame={selectedGame}
        settings={selectedGameSettings}
        isHost={isHost}
      />
    </div>
  );
}
