'use client';

import type { GamePluginSettings } from '@wanasatna/shared';
import { getClientGamePlugin } from '@/lib/game-plugins/registry';
import { registerAllClientGamePlugins } from '@/plugins';
import { GamePluginPlaceholder } from './game-plugin-placeholder';

// Synchronous module-load registration: lookups during render always find
// the plugins, with no dependency on effects or parent re-renders.
registerAllClientGamePlugins();

type GamePluginRendererProps = {
  gameId: string | null;
  isHost: boolean;
  onAction?: (action: unknown) => void;
};

export function GamePluginRenderer({ gameId, isHost, onAction }: GamePluginRendererProps) {
  if (!gameId) {
    return null;
  }

  const plugin = getClientGamePlugin(gameId);

  if (!plugin) {
    return (
      <GamePluginPlaceholder title="لعبة غير مسجّلة" message={`لم يتم العثور على plugin للعبة: ${gameId}`} />
    );
  }

  const GameScreen = plugin.GameScreen;

  return (
    <GameScreen
      state={null}
      isHost={isHost}
      dispatchAction={(action) => onAction?.(action)}
    />
  );
}

type GamePluginSettingsRendererProps = {
  gameId: string | null;
  settings: GamePluginSettings;
  onChange: (settings: GamePluginSettings) => void;
  disabled?: boolean;
};

export function GamePluginSettingsRenderer({
  gameId,
  settings,
  onChange,
  disabled = false,
}: GamePluginSettingsRendererProps) {
  if (!gameId) {
    return null;
  }

  const plugin = getClientGamePlugin(gameId);

  if (!plugin?.SettingsPanel) {
    return null;
  }

  const SettingsPanel = plugin.SettingsPanel;

  return (
    <SettingsPanel
      settings={settings}
      schema={[]}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
