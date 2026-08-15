'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoom } from '@/contexts/room-context';
import { mockGameSettingsByGameId, mockLobbyGames } from '@/lib/lobby/mock-games';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { RoomSystemState } from '@/components/room/room-system-state';
import { SystemStatus } from '@/components/ui/system-status';
import { GameGrid } from './game-grid';
import { GameSettingsPanel } from './game-settings-panel';
import { ActiveMatchWaitingPanel } from './active-match-waiting-panel';
import { LobbyChat } from './lobby-chat';
import { LobbyErrorBanner } from './lobby-error-banner';
import { LobbyHeader } from './lobby-header';
import { LobbyMarathonBanner } from './lobby-marathon-banner';
import { LobbyStartGamePanel } from './lobby-start-game-panel';
import { RoundCategoryPanel } from './round-category-panel';
import { PlayersPanel } from './players-panel';
import { cn } from '@/lib/utils';

export function LobbyScreen() {
  const {
    status,
    sessionEndReason,
    errorMessage,
    room,
    player,
    players,
    isHost,
    selectedGameId,
    lockRoom,
    unlockRoom,
    kickPlayer,
    selectGame,
    selectRoundCategory,
    leaveRoom,
    isWaitingForNextMatch,
    activeMatchParticipantIds,
    selectedRoundCategoryId,
  } = useRoom();

  const [mobileSection, setMobileSection] = useState<'games' | 'players'>('games');
  const [lobbyNotice, setLobbyNotice] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const wasReconnecting = useRef(false);

  useEffect(() => {
    try {
      const notice = sessionStorage.getItem('wanasatna:lobby-notice');
      if (notice) {
        setLobbyNotice(notice);
        sessionStorage.removeItem('wanasatna:lobby-notice');
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (status === 'reconnecting') {
      wasReconnecting.current = true;
      return;
    }
    if (status === 'connected' && wasReconnecting.current) {
      wasReconnecting.current = false;
      setRecovered(true);
      const timer = window.setTimeout(() => setRecovered(false), 2500);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [status]);

  const selectedGame = useMemo(
    () => mockLobbyGames.find((game) => game.id === selectedGameId) ?? null,
    [selectedGameId],
  );

  const selectedGameSettings = selectedGameId
    ? (mockGameSettingsByGameId[selectedGameId] ?? [])
    : [];

  if (sessionEndReason === 'kick') {
    return <RoomSystemState kind="kicked" />;
  }

  if (status === 'reconnecting' && !room) {
    return <RoomSystemState kind="reconnecting" />;
  }

  if (status === 'connecting' || status === 'idle') {
    return <RoomSystemState kind="connecting" />;
  }

  if (status === 'error' || !room) {
    return (
      <RoomSystemState
        kind="error"
        message={errorMessage}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-3 py-3 sm:px-5 sm:py-5 lg:gap-4">
      {status === 'reconnecting' ? (
        <SystemStatus tone="reconnecting" title={SYSTEM_COPY.reconnecting} />
      ) : null}
      {recovered ? <SystemStatus tone="success" title={SYSTEM_COPY.recovered} /> : null}
      {errorMessage && status !== 'reconnecting' ? <LobbyErrorBanner message={errorMessage} /> : null}
      {lobbyNotice ? <LobbyErrorBanner message={lobbyNotice} /> : null}
      {isWaitingForNextMatch ? <ActiveMatchWaitingPanel /> : null}

      <LobbyHeader
        roomCode={room.code}
        isLocked={room.isLocked}
        isHost={isHost}
        onLockRoom={() => void lockRoom()}
        onUnlockRoom={() => void unlockRoom()}
        onLeaveRoom={() => void leaveRoom()}
      />

      <div className="flex gap-2 xl:hidden">
        {(
          [
            ['games', 'الألعاب'],
            ['players', 'اللاعبون'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mobileSection === id}
            onClick={() => setMobileSection(id)}
            className={cn(
              'inline-flex h-11 min-h-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition-colors',
              mobileSection === id
                ? 'border-wanas-accent bg-wanas-accent text-white shadow-[inset_0_-3px_0_0_rgba(0,0,0,0.18)]'
                : 'border-wanas-border bg-wanas-surface text-wanas-text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(168px,200px)]">
        <div className="hidden min-w-0 xl:order-3 xl:block">
          <LobbyChat />
        </div>

        <div
          className={cn(
            'flex min-w-0 flex-col gap-2 xl:order-2 lg:gap-2',
            mobileSection !== 'games' && 'hidden xl:flex',
          )}
        >
          <GameGrid
            games={mockLobbyGames}
            selectedGameId={selectedGameId}
            canSelect={isHost}
            onSelectGame={selectGame}
          />
          <LobbyMarathonBanner />
          <RoundCategoryPanel
            gameId={selectedGameId}
            selectedCategoryId={selectedRoundCategoryId}
            isHost={isHost}
            isActiveMatch={activeMatchParticipantIds !== null}
            onSelectCategory={selectRoundCategory}
          />
          <GameSettingsPanel selectedGame={selectedGame} settings={selectedGameSettings} isHost={isHost} />
          <LobbyStartGamePanel />
        </div>

        <div className={cn('xl:order-1', mobileSection !== 'players' && 'hidden xl:block')}>
          <PlayersPanel
            players={players}
            currentPlayerId={player?.id}
            isHost={isHost}
            onKickPlayer={(playerId) => void kickPlayer(playerId)}
            activeMatchParticipantIds={activeMatchParticipantIds}
            hasActiveMatch={isWaitingForNextMatch || activeMatchParticipantIds !== null}
          />
        </div>
      </div>
    </div>
  );
}
