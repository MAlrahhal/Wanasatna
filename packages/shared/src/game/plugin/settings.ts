import type { GamePluginSettings, GamePluginSettingsField, GamePluginSettingsValidationResult } from './types.js';

export type GamePluginSettingsDefinition<TSettings extends GamePluginSettings = GamePluginSettings> = {
  defaultSettings: TSettings;
  settingsSchema: GamePluginSettingsField[];
  validateSettings?: (settings: unknown) => GamePluginSettingsValidationResult<TSettings>;
};

export type GamePluginStartValidation<
  TSettings extends GamePluginSettings = GamePluginSettings,
> = {
  validateStart?: (
    context: import('./types.js').GamePluginLifecycleContext,
    settings: TSettings,
  ) => import('./types.js').GamePluginValidationResult;
};
