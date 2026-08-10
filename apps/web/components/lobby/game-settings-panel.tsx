'use client';

import type { LobbyGame, LobbyGameSettingsPlaceholder } from '@/lib/lobby/types';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { useRoom } from '@/contexts/room-context';
import { GUESSING_CHALLENGE_GAME_ID, TIMING_CHALLENGE_GAME_ID } from '@wanasatna/shared';
import { EmptyState } from './empty-state';
import { LobbyPanel } from './lobby-ui';
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
    teamSnapshot,
    assignPlayerTeam,
    randomizeTeams,
    players,
  } = useRoom();
  const catalogEntry = selectedGame ? getGameCatalogEntry(selectedGame.id) : null;
  const isTimingChallenge = selectedGame?.id === TIMING_CHALLENGE_GAME_ID;
  const isGuessingChallenge = selectedGame?.id === GUESSING_CHALLENGE_GAME_ID;
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
      bodyClassName="gap-3 p-4"
    >
      {!selectedGame ? (
        <EmptyState
          title="اختر لعبة لعرض إعداداتها."
          description="ستظهر هنا إعدادات اللعبة المختارة."
        />
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-wanas-border bg-wanas-surface-soft p-3">
            <div className="flex items-center gap-2.5">
              <div
                className="flex size-9 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  backgroundColor: catalogEntry?.iconBg,
                  color: catalogEntry?.iconText,
                }}
              >
                {selectedGame.iconLabel}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-wanas-text-primary">{selectedGame.title}</p>
                <p className="mt-0.5 text-[11px] text-wanas-text-muted">{catalogEntry?.playerRange}</p>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-wanas-text-muted">{selectedGame.description}</p>
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
          ) : (
            <div className="space-y-1.5">
              {settings.map((setting) => (
                <div
                  key={setting.id}
                  className="flex items-center justify-between rounded-lg border border-wanas-border bg-wanas-surface-soft px-3 py-2"
                >
                  <span className="text-xs text-wanas-text-muted">{setting.label}</span>
                  <span className="text-xs font-bold text-wanas-text-primary">{setting.value}</span>
                </div>
              ))}
            </div>
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
