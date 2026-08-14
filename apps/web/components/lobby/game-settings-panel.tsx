'use client';

import type { LobbyGame, LobbyGameSettingsPlaceholder } from '@/lib/lobby/types';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { useRoom } from '@/contexts/room-context';
import { GUESSING_CHALLENGE_GAME_ID, TIMING_CHALLENGE_GAME_ID, DRAW_GUESS_GAME_ID } from '@wanasatna/shared';
import { EmptyState } from './empty-state';
import { LobbyPanel } from './lobby-ui';
import { DrawGuessSettingsPanel } from './draw-guess-settings-panel';
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
  const {
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
  } = useRoom();
  const catalogEntry = selectedGame ? getGameCatalogEntry(selectedGame.id) : null;
  const isTimingChallenge = selectedGame?.id === TIMING_CHALLENGE_GAME_ID;
  const isGuessingChallenge = selectedGame?.id === GUESSING_CHALLENGE_GAME_ID;
  const isDrawGuess = selectedGame?.id === DRAW_GUESS_GAME_ID;
  const showsTeams =
    Boolean(teamSnapshot) || Boolean(selectedGame && getGameTeamCapability(selectedGame.id));

  return (
    <LobbyPanel
      title="إعدادات اللعبة"
      description={
        selectedGame
          ? isHost
            ? 'يمكن للمضيف تعديل الإعدادات عند توفرها.'
            : 'عرض فقط — التعديل متاح للمضيف.'
          : undefined
      }
      bodyClassName="gap-2 p-3"
    >
      {!selectedGame ? (
        <EmptyState
          compact
          title="لم يتم اختيار لعبة"
          description="اختر لعبة من القائمة لعرض إعداداتها."
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: catalogEntry?.iconBg,
                color: catalogEntry?.iconText,
              }}
            >
              {selectedGame.iconLabel}
            </div>
            <p className="min-w-0 truncate text-sm font-bold text-wanas-text-primary">{selectedGame.title}</p>
          </div>

          {isTimingChallenge ? (
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
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-wanas-text-muted">إعدادات ثابتة لهذه اللعبة.</p>
              {settings.map((setting) => (
                <div
                  key={setting.id}
                  className="flex min-h-11 items-center justify-between rounded-lg border border-wanas-border bg-wanas-surface-soft px-3 py-2"
                >
                  <span className="text-xs text-wanas-text-muted">{setting.label}</span>
                  <span className="text-xs font-bold text-wanas-text-primary">{setting.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs leading-5 text-wanas-text-muted">لا توجد إعدادات إضافية لهذه اللعبة.</p>
          )}

          {showsTeams ? (
            <TeamAssignmentPanel
              snapshot={teamSnapshot}
              players={players}
              isHost={isHost}
              onAssign={assignPlayerTeam}
              onRandomize={() => {
                void randomizeTeams();
              }}
            />
          ) : null}
        </div>
      )}
    </LobbyPanel>
  );
}
