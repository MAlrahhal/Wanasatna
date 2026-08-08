import type { LobbyGame, LobbyGameSettingsPlaceholder } from '@/lib/lobby/types';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { EmptyState } from './empty-state';
import { LobbyPanel } from './lobby-ui';

type GameSettingsPanelProps = {
  selectedGame: LobbyGame | null;
  settings: LobbyGameSettingsPlaceholder[];
  isHost: boolean;
};

export function GameSettingsPanel({ selectedGame, settings, isHost }: GameSettingsPanelProps) {
  const catalogEntry = selectedGame ? getGameCatalogEntry(selectedGame.id) : null;

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
        </div>
      )}
    </LobbyPanel>
  );
}
