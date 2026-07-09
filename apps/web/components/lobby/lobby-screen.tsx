'use client';

import { useMemo } from 'react';
import { useRoom } from '@/contexts/room-context';
import { mockGameSettingsByGameId, mockLobbyGames } from '@/lib/lobby/mock-games';
import { GameGrid } from './game-grid';
import { GameSettingsPanel } from './game-settings-panel';
import { LobbyChat } from './lobby-chat';
import { LobbyErrorBanner } from './lobby-error-banner';
import { LobbyHeader } from './lobby-header';
import { PlayersPanel } from './players-panel';

export function LobbyScreen() {
  const {
    status,
    errorMessage,
    room,
    players,
    isHost,
    selectedGameId,
    lockRoom,
    unlockRoom,
    kickPlayer,
    selectGame,
    leaveRoom,
  } = useRoom();

  const selectedGame = useMemo(
    () => mockLobbyGames.find((game) => game.id === selectedGameId) ?? null,
    [selectedGameId],
  );

  const selectedGameSettings = selectedGameId
    ? (mockGameSettingsByGameId[selectedGameId] ?? [])
    : [];

  if (status === 'connecting' || status === 'idle') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">جاري الاتصال بالغرفة...</p>
      </div>
    );
  }

  if (status === 'error' || !room) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col justify-center gap-4 p-6">
        {errorMessage ? <LobbyErrorBanner message={errorMessage} /> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
      {errorMessage ? <LobbyErrorBanner message={errorMessage} /> : null}

      <LobbyHeader
        roomCode={room.code}
        isLocked={room.isLocked}
        isHost={isHost}
        onLockRoom={() => void lockRoom()}
        onUnlockRoom={() => void unlockRoom()}
        onLeaveRoom={() => void leaveRoom()}
      />

      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="xl:min-h-[720px]">
          <PlayersPanel
            players={players}
            isHost={isHost}
            onKickPlayer={(playerId) => void kickPlayer(playerId)}
          />
        </div>

        <div className="flex flex-col gap-4">
          <GameGrid
            games={mockLobbyGames}
            selectedGameId={selectedGameId}
            canSelect={isHost}
            onSelectGame={selectGame}
          />
          <GameSettingsPanel selectedGame={selectedGame} settings={selectedGameSettings} />
        </div>

        <div className="xl:min-h-[720px]">
          <LobbyChat />
        </div>
      </div>
    </div>
  );
}
