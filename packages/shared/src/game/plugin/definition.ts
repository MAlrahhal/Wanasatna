import type { GamePluginLifecycleHooks } from './lifecycle.js';
import type { GamePluginSettingsDefinition, GamePluginStartValidation } from './settings.js';
import type { GameStateFactory } from './state.js';
import type { GamePluginSocketDefinition } from './events.js';
import type { GamePluginMetadata, GamePluginSettings } from './types.js';

/**
 * Server-side game plugin contract.
 * The Game Shell runtime interacts with games only through this interface.
 */
export type GamePluginDefinition<
  TState = unknown,
  TSettings extends GamePluginSettings = GamePluginSettings,
> = GamePluginMetadata &
  GamePluginSettingsDefinition<TSettings> &
  GamePluginStartValidation<TSettings> &
  GameStateFactory<TState, TSettings> & {
    lifecycle: GamePluginLifecycleHooks<TState, TSettings>;
    socket?: GamePluginSocketDefinition;
  };

export type RegisteredGamePlugin = {
  gameId: string;
  plugin: GamePluginDefinition;
};
