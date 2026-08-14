'use client';

import { useMemo, useRef, useState } from 'react';
import { GUESSING_CHALLENGE_GAME_ID, TIMING_CHALLENGE_GAME_ID } from '@wanasatna/shared';
import { useRoom } from '@/contexts/room-context';
import { getGameStartPlayerRequirementReason } from '@/lib/game-shell/start-validation';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { mockLobbyGames } from '@/lib/lobby/mock-games';
import { LobbyPanel } from './lobby-ui';
import { Button } from '@/components/ui/button';
import { SystemStatus } from '@/components/ui/system-status';

export function LobbyStartGamePanel() {
  const {
    isHost,
    selectedGameId,
    status,
    startGame,
    players,
    isWaitingForNextMatch,
    timingChallengeSettings,
    guessingChallengeMode,
    teamSnapshot,
  } = useRoom();
  const [isStarting, setIsStarting] = useState(false);
  const startingRef = useRef(false);

  const selectedGame = mockLobbyGames.find((game) => game.id === selectedGameId) ?? null;
  const catalogEntry = selectedGameId ? getGameCatalogEntry(selectedGameId) : null;

  const activeParticipantCount = useMemo(
    () => players.filter((player) => !player.isSpectator).length,
    [players],
  );

  const disabledReason = useMemo(() => {
    if (isWaitingForNextMatch) {
      return 'هناك مباراة جارية حاليًا';
    }
    if (status !== 'connected') {
      return 'الاتصال غير جاهز';
    }
    if (!selectedGameId) {
      return 'لم يتم اختيار لعبة';
    }
    if (catalogEntry?.availability === 'coming-soon') {
      return 'اللعبة غير متاحة';
    }

    const playerRequirementReason = getGameStartPlayerRequirementReason(
      selectedGameId,
      activeParticipantCount,
      selectedGameId === GUESSING_CHALLENGE_GAME_ID ? guessingChallengeMode : undefined,
      teamSnapshot,
    );

    if (playerRequirementReason) {
      return playerRequirementReason;
    }

    if (
      selectedGameId === TIMING_CHALLENGE_GAME_ID &&
      timingChallengeSettings.minSeconds >= timingChallengeSettings.maxSeconds
    ) {
      return 'نطاق الوقت غير صالح';
    }

    return null;
  }, [
    activeParticipantCount,
    catalogEntry?.availability,
    guessingChallengeMode,
    isWaitingForNextMatch,
    selectedGameId,
    status,
    teamSnapshot,
    timingChallengeSettings.maxSeconds,
    timingChallengeSettings.minSeconds,
  ]);

  async function handleStartGame() {
    if (startingRef.current || disabledReason) {
      return;
    }

    startingRef.current = true;
    setIsStarting(true);

    try {
      await startGame();
    } finally {
      startingRef.current = false;
      setIsStarting(false);
    }
  }

  if (!isHost) {
    return (
      <LobbyPanel title="بدء اللعبة" bodyClassName="p-3">
        <SystemStatus tone="info" title="بانتظار المضيف لبدء اللعبة." />
      </LobbyPanel>
    );
  }

  return (
    <LobbyPanel
      title="بدء اللعبة"
      description={selectedGame ? undefined : 'اختر لعبة من القائمة ثم ابدأ.'}
      bodyClassName="gap-2 p-3"
    >
      {selectedGame ? (
        <p className="text-sm font-bold text-wanas-text-primary">{selectedGame.title}</p>
      ) : null}
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={Boolean(disabledReason) || isStarting}
        loading={isStarting}
        onClick={() => void handleStartGame()}
      >
        {isStarting ? 'جاري البدء…' : 'بدء اللعبة'}
      </Button>
      {disabledReason ? (
        <p className="text-center text-xs font-medium text-wanas-text-muted">{disabledReason}</p>
      ) : null}
    </LobbyPanel>
  );
}
