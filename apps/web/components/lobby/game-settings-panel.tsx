import type { LobbyGame, LobbyGameSettingsPlaceholder } from '@/lib/lobby/types';
import { EmptyState } from './empty-state';

type GameSettingsPanelProps = {
  selectedGame: LobbyGame | null;
  settings: LobbyGameSettingsPlaceholder[];
};

export function GameSettingsPanel({ selectedGame, settings }: GameSettingsPanelProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">إعدادات اللعبة</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          الإعدادات التجريبية فقط — بدون منطق فعلي حالياً.
        </p>
      </div>

      {!selectedGame ? (
        <EmptyState
          title="لم يتم اختيار لعبة"
          description="اختر لعبة من القائمة لعرض الإعدادات المتاحة."
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">{selectedGame.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{selectedGame.description}</p>
          </div>

          <div className="space-y-2">
            {settings.map((setting) => (
              <div
                key={setting.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
              >
                <span className="text-sm text-muted-foreground">{setting.label}</span>
                <span className="text-sm font-medium text-foreground">{setting.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
