'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getDefaultPlayerAvatarId } from '@wanasatna/shared';
import { AdPlaceholder } from '@/components/ads/ad-placeholder';
import { useRoom } from '@/contexts/room-context';
import { mockGameSettingsByGameId, mockLobbyGames } from '@/lib/lobby/mock-games';
import { usePlayableGameAvailability } from '@/lib/games/use-game-availability';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { LOBBY_NOTICE_STORAGE_KEY } from '@/lib/game-shell/null-shell-recovery';
import { RoomSystemState } from '@/components/room/room-system-state';
import { SystemStatus } from '@/components/ui/system-status';
import { GameGrid } from './game-grid';
import { ActiveMatchWaitingPanel } from './active-match-waiting-panel';
import { LobbyChat } from './lobby-chat';
import { LobbyErrorBanner } from './lobby-error-banner';
import { LobbyHeader } from './lobby-header';
import { LobbyMarathonBanner } from './lobby-marathon-banner';
import { LobbyStartGamePanel } from './lobby-start-game-panel';
import { LobbySelectedGameSetup } from './lobby-selected-game-setup';
import { PlayersPanel } from './players-panel';
import { AvatarPickerDialog } from './avatar-picker-dialog';
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
    endRoom,
    updatePlayerAvatar,
    isWaitingForNextMatch,
    activeMatchParticipantIds,
    selectedRoundCategoryId,
  } = useRoom();
  const { isGameEnabled } = usePlayableGameAvailability();

  const [mobileSection, setMobileSection] = useState<'games' | 'players'>('games');
  const [chatOpen, setChatOpen] = useState(false);
  const [lobbyNotice, setLobbyNotice] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const wasReconnecting = useRef(false);

  useEffect(() => {
    if (selectedGameId && !isGameEnabled(selectedGameId) && isHost) {
      selectGame('');
    }
  }, [isGameEnabled, isHost, selectGame, selectedGameId]);

  useEffect(() => {
    try {
      const notice = sessionStorage.getItem(LOBBY_NOTICE_STORAGE_KEY);
      if (notice) {
        setLobbyNotice(notice);
        sessionStorage.removeItem(LOBBY_NOTICE_STORAGE_KEY);
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

  useEffect(() => {
    if (!chatOpen) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setChatOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [chatOpen]);

  const selectedGame = useMemo(
    () => mockLobbyGames.find((game) => game.id === selectedGameId) ?? null,
    [selectedGameId],
  );

  const selectedGameSettings = selectedGameId
    ? (mockGameSettingsByGameId[selectedGameId] ?? [])
    : [];
  const hasActiveMatch = isWaitingForNextMatch || activeMatchParticipantIds !== null;

  if (sessionEndReason === 'kick') {
    return <RoomSystemState kind="kicked" />;
  }

  if (sessionEndReason === 'closed') {
    return <RoomSystemState kind="closed" message={errorMessage} />;
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
      {errorMessage && status !== 'reconnecting' ? (
        <LobbyErrorBanner message={errorMessage} />
      ) : null}
      {lobbyNotice ? <LobbyErrorBanner message={lobbyNotice} /> : null}
      {isWaitingForNextMatch ? <ActiveMatchWaitingPanel /> : null}

      <LobbyHeader
        roomCode={room.code}
        isLocked={room.isLocked}
        isHost={isHost}
        onLockRoom={() => void lockRoom()}
        onUnlockRoom={() => void unlockRoom()}
        onLeaveRoom={() => void leaveRoom()}
        onEndRoom={endRoom}
        onChangeAvatar={() => setAvatarPickerOpen(true)}
        canChangeAvatar={!hasActiveMatch}
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
        <button
          type="button"
          aria-pressed={chatOpen}
          aria-label="الدردشة"
          onClick={() => setChatOpen(true)}
          className="border-wanas-border bg-wanas-surface text-wanas-text-muted inline-flex h-11 min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold"
        >
          دردشة
        </button>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(168px,200px)]">
        <div
          className={cn(
            chatOpen
              ? 'border-wanas-border bg-wanas-surface fixed inset-x-0 bottom-0 z-40 flex max-h-[55dvh] flex-col rounded-t-2xl border-t p-3 shadow-[var(--wanas-shadow-panel)]'
              : 'hidden',
            'xl:static xl:z-auto xl:order-3 xl:flex xl:max-h-[calc(100vh-12rem)] xl:flex-col xl:gap-3 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none',
          )}
          role={chatOpen ? 'dialog' : undefined}
          aria-modal={chatOpen ? true : undefined}
          aria-label={chatOpen ? SYSTEM_COPY.chatTitle : undefined}
          style={
            chatOpen
              ? { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }
              : undefined
          }
        >
          {chatOpen ? (
            <div className="mb-2 flex items-center justify-between xl:hidden">
              <p className="text-wanas-text-primary text-sm font-semibold">
                {SYSTEM_COPY.chatTitle}
              </p>
              <button
                type="button"
                className="text-wanas-text-muted inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg"
                aria-label="إغلاق"
                onClick={() => setChatOpen(false)}
              >
                ✕
              </button>
            </div>
          ) : null}
          <LobbyChat className="min-h-0" />
          <AdPlaceholder
            placement="lobby-chat-desktop"
            format="vertical"
            className="hidden h-[clamp(7rem,15vh,10rem)] shrink-0 xl:flex"
          />
        </div>

        <div
          className={cn(
            'flex min-w-0 flex-col gap-2 lg:gap-2 xl:order-2',
            mobileSection !== 'games' && 'hidden xl:flex',
          )}
        >
          <GameGrid
            games={mockLobbyGames}
            selectedGameId={selectedGameId}
            canSelect={isHost}
            onSelectGame={selectGame}
            isGameEnabled={isGameEnabled}
          />
          <LobbyMarathonBanner />
          <LobbySelectedGameSetup
            key={selectedGameId ?? 'none'}
            selectedGameId={selectedGameId}
            selectedGame={selectedGame}
            selectedGameSettings={selectedGameSettings}
            selectedRoundCategoryId={selectedRoundCategoryId}
            isHost={isHost}
            isWaitingForNextMatch={isWaitingForNextMatch}
            onSelectCategory={selectRoundCategory}
          />
          <LobbyStartGamePanel />
        </div>

        <div
          className={cn(
            'xl:order-1 xl:flex xl:max-h-[calc(100vh-12rem)] xl:min-h-0 xl:flex-col xl:gap-3',
            mobileSection !== 'players' && 'hidden xl:flex',
          )}
        >
          <PlayersPanel
            players={players}
            currentPlayerId={player?.id}
            isHost={isHost}
            onKickPlayer={(playerId) => void kickPlayer(playerId)}
            activeMatchParticipantIds={activeMatchParticipantIds}
            hasActiveMatch={hasActiveMatch}
            playerCap={room?.playerCap}
            onChangeAvatar={() => setAvatarPickerOpen(true)}
          />
          <AdPlaceholder
            placement="lobby-players-desktop"
            format="vertical"
            className="hidden h-[clamp(7rem,15vh,10rem)] shrink-0 xl:flex"
          />
        </div>
      </div>

      <AdPlaceholder
        placement="lobby-mobile"
        format="horizontal"
        className="xl:hidden"
      />

      {player ? (
        <AvatarPickerDialog
          open={avatarPickerOpen}
          playerId={player.id}
          playerName={player.name}
          selectedAvatarId={player.avatarId ?? getDefaultPlayerAvatarId(player.id)}
          onClose={() => setAvatarPickerOpen(false)}
          onSelect={(avatarId) => {
            void updatePlayerAvatar(avatarId).then((success) => {
              if (success) setAvatarPickerOpen(false);
            });
          }}
        />
      ) : null}
    </div>
  );
}
