'use client';

import { useMemo, useState } from 'react';
import { mockLobbyChatMessages } from '@/lib/lobby/mock-chat';
import { mockGameSettingsByGameId, mockLobbyGames } from '@/lib/lobby/mock-games';
import { mockLobbyRoom } from '@/lib/lobby/mock-room';
import { GameGrid } from './game-grid';
import { GameSettingsPanel } from './game-settings-panel';
import { LobbyChat } from './lobby-chat';
import { LobbyHeader } from './lobby-header';
import { PlayersPanel } from './players-panel';

export function LobbyScreen() {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const selectedGame = useMemo(
    () => mockLobbyGames.find((game) => game.id === selectedGameId) ?? null,
    [selectedGameId],
  );

  const selectedGameSettings = selectedGameId
    ? (mockGameSettingsByGameId[selectedGameId] ?? [])
    : [];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
      <LobbyHeader roomCode={mockLobbyRoom.code} isLocked={mockLobbyRoom.isLocked} />

      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="xl:min-h-[720px]">
          <PlayersPanel players={mockLobbyRoom.players} />
        </div>

        <div className="flex flex-col gap-4">
          <GameGrid
            games={mockLobbyGames}
            selectedGameId={selectedGameId}
            onSelectGame={setSelectedGameId}
          />
          <GameSettingsPanel selectedGame={selectedGame} settings={selectedGameSettings} />
        </div>

        <div className="xl:min-h-[720px]">
          <LobbyChat initialMessages={mockLobbyChatMessages} />
        </div>
      </div>
    </div>
  );
}
