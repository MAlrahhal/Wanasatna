/**
 * Opaque game state envelope.
 * The Game Shell stores and forwards this without inspecting `payload`.
 */
export type SerializedGameState = {
  gameId: string;
  version: number;
  payload: unknown;
};

import type { GamePluginSettings } from './types.js';

export type GameStateFactory<
  TState = unknown,
  TSettings extends GamePluginSettings = GamePluginSettings,
> = {
  createInitialState: (
    context: import('./types.js').GamePluginLifecycleContext,
    settings: TSettings,
  ) => TState;
  serializeState: (state: TState) => unknown;
  deserializeState: (payload: unknown) => TState;
};
