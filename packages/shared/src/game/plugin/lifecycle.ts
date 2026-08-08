import type { GamePluginLifecycleContext, GamePluginSettings } from './types.js';

/**
 * Generic lifecycle hooks invoked by the Game Shell runtime.
 * Each game plugin implements only the hooks it needs.
 */
export type GamePluginLifecycleHooks<
  TState = unknown,
  TSettings extends GamePluginSettings = GamePluginSettings,
> = {
  onInit?: (
    context: GamePluginLifecycleContext,
    settings: TSettings,
  ) => Promise<TState> | TState;

  onCountdownStart?: (
    context: GamePluginLifecycleContext,
    state: TState,
  ) => Promise<void> | void;

  onGameStart?: (
    context: GamePluginLifecycleContext,
    state: TState,
  ) => Promise<void> | void;

  onPlayerAction?: (
    context: GamePluginLifecycleContext,
    state: TState,
    action: unknown,
  ) => Promise<TState> | TState;

  onRoundEnd?: (
    context: GamePluginLifecycleContext,
    state: TState,
  ) => Promise<TState> | TState;

  onGameEnd?: (
    context: GamePluginLifecycleContext,
    state: TState,
  ) => Promise<void> | void;
};

export type GamePluginLifecycleHookName = keyof GamePluginLifecycleHooks;
