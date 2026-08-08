import type { ComponentType } from 'react';
import type {
  ClientGamePlugin,
  GamePluginHudProps,
  GamePluginScreenProps,
  GamePluginSettings,
  GamePluginSettingsPanelProps,
} from '@wanasatna/shared';

export type WebClientGamePlugin<
  TState = unknown,
  TSettings extends GamePluginSettings = GamePluginSettings,
> = Omit<ClientGamePlugin<TState, TSettings>, 'GameScreen' | 'GameHUD' | 'SettingsPanel'> & {
  GameScreen: ComponentType<GamePluginScreenProps<TState>>;
  GameHUD?: ComponentType<GamePluginHudProps<TState>>;
  SettingsPanel?: ComponentType<GamePluginSettingsPanelProps<TSettings>>;
};
