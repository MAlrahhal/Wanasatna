'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRoom } from '@/contexts/room-context';
import { mockGameSettingsByGameId, mockLobbyGames } from '@/lib/lobby/mock-games';
import { GameGrid } from './game-grid';
import { GameSettingsPanel } from './game-settings-panel';
import { ActiveMatchWaitingPanel } from './active-match-waiting-panel';
import { LobbyChat } from './lobby-chat';
import { LobbyErrorBanner } from './lobby-error-banner';
import { LobbyHeader } from './lobby-header';
import { LobbyStartGamePanel } from './lobby-start-game-panel';
import { PlayersPanel } from './players-panel';
import { LobbyStateCard } from './lobby-ui';
import { cn } from '@/lib/utils';

function LoadingSpinner() {
  return (
    <span className="size-8 animate-spin rounded-full border-[3px] border-wanas-primary-muted border-t-wanas-primary" />
  );
}

export function LobbyScreen() {
  const {
    status,
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

  const [mobileSection, setMobileSection] = useState<'games' | 'players' | 'chat'>('games');
  const [lobbyNotice, setLobbyNotice] = useState<string | null>(null);

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

  const selectedGame = useMemo(
    () => mockLobbyGames.find((game) => game.id === selectedGameId) ?? null,
    [selectedGameId],
  );

  const selectedGameSettings = selectedGameId
    ? (mockGameSettingsByGameId[selectedGameId] ?? [])
    : [];

  if (status === 'connecting' || status === 'idle') {
    return (
      <LobbyStateCard
        title="جاري تجهيز الغرفة..."
        description="جاري إعادة الاتصال بالغرفة..."
        icon={<LoadingSpinner />}
      />
    );
  }

  if (status === 'error' || !room) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col justify-center gap-4 p-4 sm:p-6">
        <LobbyStateCard
          title="تعذر الدخول إلى الغرفة"
          description={errorMessage ?? 'حدث خطأ أثناء الاتصال بالغرفة.'}
          icon={
            <span className="text-2xl font-bold" aria-hidden>
              !
            </span>
          }
          action={
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-wanas-accent px-5 text-sm font-bold text-white hover:bg-wanas-accent-hover"
            >
              العودة للرئيسية
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-3 py-4 sm:px-5 sm:py-5 lg:gap-4">
      {errorMessage ? <LobbyErrorBanner message={errorMessage} /> : null}
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
            ['chat', 'الدردشة'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mobileSection === id}
            onClick={() => setMobileSection(id)}
            className={cn(
              'inline-flex h-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition-colors',
              mobileSection === id
                ? 'border-wanas-accent bg-wanas-accent/10 text-wanas-accent'
                : 'border-wanas-border bg-wanas-surface text-wanas-text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-[280px_minmax(0,1fr)_260px]">
        <div className={cn('xl:order-3', mobileSection !== 'chat' && 'hidden xl:block')}>
          <LobbyChat />
        </div>

        <div
          className={cn(
            'flex flex-col gap-3 xl:order-2 lg:gap-4',
            mobileSection !== 'games' && 'hidden xl:flex',
          )}
        >
          <GameGrid
            games={mockLobbyGames}
            selectedGameId={selectedGameId}
            selectedRoundCategoryId={selectedRoundCategoryId}
            canSelect={isHost}
            isActiveMatch={activeMatchParticipantIds !== null}
            onSelectGame={selectGame}
            onSelectRoundCategory={selectRoundCategory}
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
