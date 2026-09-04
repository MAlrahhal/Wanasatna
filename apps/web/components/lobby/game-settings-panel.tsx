'use client';

import type { LobbyGame, LobbyGameSettingsPlaceholder } from '@/lib/lobby/types';
import { useAuth } from '@/contexts/auth-context';
import { useRoom } from '@/contexts/room-context';
import {
  GUESSING_CHALLENGE_GAME_ID,
  TIMING_CHALLENGE_GAME_ID,
  DRAW_GUESS_GAME_ID,
} from '@wanasatna/shared';
import { DrawGuessSettingsPanel } from './draw-guess-settings-panel';
import { ExperimentalGameSettingsPanel } from './experimental-game-settings-panel';
import { GuessingChallengeSettingsPanel } from './guessing-challenge-settings-panel';
import { TimingChallengeSettingsPanel } from './timing-challenge-settings-panel';
import { TeamAssignmentPanel } from './team-assignment-panel';
import { getGameTeamCapability } from '@wanasatna/shared';

type GameSettingsPanelProps = {
  selectedGame: LobbyGame | null;
  settings: LobbyGameSettingsPlaceholder[];
  isHost: boolean;
};

export function GameSettingsPanel({ selectedGame, settings, isHost }: GameSettingsPanelProps) {
  const { user } = useAuth();
  const {
    room,
    timingChallengeSettings,
    setTimingChallengeSettings,
    guessingChallengeMode,
    setGuessingChallengeMode,
    drawGuessDrawerMode,
    setDrawGuessDrawerMode,
    drawGuessFixedPlayerId,
    setDrawGuessFixedPlayerId,
    teamSnapshot,
    assignPlayerTeam,
    randomizeTeams,
    players,
    updateRoomGameSettings,
  } = useRoom();
  const isAdmin = user?.role === 'ADMIN';
  const isTimingChallenge = selectedGame?.id === TIMING_CHALLENGE_GAME_ID;
  const isGuessingChallenge = selectedGame?.id === GUESSING_CHALLENGE_GAME_ID;
  const isDrawGuess = selectedGame?.id === DRAW_GUESS_GAME_ID;
  const showsTeams = Boolean(
    selectedGame &&
    getGameTeamCapability(selectedGame.id) &&
    teamSnapshot?.gameId === selectedGame.id,
  );

  return (
    <section className="border-wanas-border bg-wanas-surface rounded-xl border px-2.5 py-2 xl:px-3 xl:py-2.5">
      <div className="mb-2 flex items-start gap-2">
        <span
          className="bg-wanas-primary-surface flex size-8 shrink-0 items-center justify-center rounded-full text-sm"
          aria-hidden
        >
          ⚙
        </span>
        <h3 className="text-wanas-text-primary min-w-0 self-center text-sm font-bold">
          إعدادات اللعبة
        </h3>
      </div>

      {!selectedGame ? (
        <p className="text-wanas-text-muted text-xs">لا توجد إعدادات حتى يتم اختيار لعبة.</p>
      ) : isTimingChallenge ? (
        <TimingChallengeSettingsPanel
          settings={timingChallengeSettings}
          isHost={isHost}
          onChange={setTimingChallengeSettings}
        />
      ) : isGuessingChallenge ? (
        <GuessingChallengeSettingsPanel
          mode={guessingChallengeMode}
          isHost={isHost}
          onChange={setGuessingChallengeMode}
        />
      ) : isDrawGuess ? (
        <DrawGuessSettingsPanel
          drawerMode={drawGuessDrawerMode}
          fixedPlayerId={drawGuessFixedPlayerId}
          players={players
            .filter((player) => !player.isSpectator)
            .map((player) => ({ id: player.id, name: player.name }))}
          isHost={isHost}
          onDrawerModeChange={setDrawGuessDrawerMode}
          onFixedPlayerChange={setDrawGuessFixedPlayerId}
        />
      ) : settings.length > 0 ? (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {settings.map((setting) => (
            <div
              key={setting.id}
              className="border-wanas-border bg-wanas-surface-soft flex min-h-10 items-center justify-between rounded-lg border px-3 py-2"
            >
              <span className="text-wanas-text-muted text-[11px]">{setting.label}</span>
              <span className="text-wanas-text-primary text-xs font-bold">{setting.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-wanas-text-muted text-xs">لا توجد إعدادات إضافية لهذه اللعبة.</p>
      )}

      {isAdmin && isHost && selectedGame ? (
        <ExperimentalGameSettingsPanel
          gameId={selectedGame.id}
          roomSettings={room?.gameSettings ?? null}
          timingHostSettings={isTimingChallenge ? timingChallengeSettings : undefined}
          playerCount={players.filter((player) => !player.isSpectator).length}
          onChange={(gameId, nextSettings) => {
            void updateRoomGameSettings(gameId, nextSettings);
          }}
        />
      ) : null}

      {showsTeams ? (
        <div className="mt-2">
          <TeamAssignmentPanel
            snapshot={teamSnapshot}
            players={players}
            isHost={isHost}
            onAssign={assignPlayerTeam}
            onRandomize={() => {
              void randomizeTeams();
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
