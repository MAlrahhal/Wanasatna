import type { GamePluginMetadata, GamePluginSettings, GamePluginSettingsField } from './types.js';

export type GamePluginScreenProps<TState = unknown> = {
  state: TState | null;
  isHost: boolean;
  dispatchAction: (action: unknown) => void;
};

export type GamePluginHudProps<TState = unknown> = {
  state: TState | null;
  isHost: boolean;
};

export type GamePluginSettingsPanelProps<TSettings extends GamePluginSettings = GamePluginSettings> = {
  settings: TSettings;
  schema: GamePluginSettingsField[];
  onChange: (settings: TSettings) => void;
  disabled?: boolean;
};

/** Opaque component reference — concrete React types live in the web app. */
export type GamePluginComponent<TProps = unknown> = (props: TProps) => unknown;

export type ClientGamePlugin<
  TState = unknown,
  TSettings extends GamePluginSettings = GamePluginSettings,
> = {
  metadata: GamePluginMetadata;
  GameScreen: GamePluginComponent<GamePluginScreenProps<TState>>;
  GameHUD?: GamePluginComponent<GamePluginHudProps<TState>>;
  SettingsPanel?: GamePluginComponent<GamePluginSettingsPanelProps<TSettings>>;
};

export type GamePluginPlaceholderProps = {
  title: string;
  message?: string;
};
