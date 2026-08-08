import type { GamePhase, GamePluginLifecycleContext, GamePluginLifecycleHookName } from '@wanasatna/shared';
import type { GameShellRecord } from '../game.service.js';
import { getGamePluginDefinition } from './plugin-registry.js';

/**
 * Bridge between the Game Shell and a registered plugin.
 * The shell invokes hooks; it never reads game-specific state.
 */
export type PluginRuntimeContext = {
  shell: GameShellRecord;
  settings: Record<string, string | number | boolean>;
  gameState: unknown | null;
};

export async function invokePluginLifecycleHook(
  hook: GamePluginLifecycleHookName,
  context: PluginRuntimeContext,
): Promise<unknown | null> {
  const plugin = getGamePluginDefinition(context.shell.gameId ?? '');

  if (!plugin?.lifecycle[hook]) {
    return context.gameState;
  }

  const lifecycleContext: GamePluginLifecycleContext = {
    roomId: context.shell.roomId,
    shellId: context.shell.shellId,
    gameId: context.shell.gameId ?? plugin.id,
    hostPlayerId: context.shell.hostPlayerId,
    players: context.shell.players,
    phase: context.shell.phase as GamePhase,
  };

  const handler = plugin.lifecycle[hook] as (
    ctx: GamePluginLifecycleContext,
    stateOrSettings: unknown,
    action?: unknown,
  ) => Promise<unknown> | unknown;

  switch (hook) {
    case 'onInit':
      return handler(lifecycleContext, context.settings);
    case 'onPlayerAction':
      return handler(lifecycleContext, context.gameState, undefined);
    case 'onCountdownStart':
    case 'onGameStart':
    case 'onGameEnd':
      await handler(lifecycleContext, context.gameState);
      return context.gameState;
    case 'onRoundEnd':
      return handler(lifecycleContext, context.gameState);
    default:
      return context.gameState;
  }
}

export function serializePluginState(
  gameId: string,
  state: unknown,
): { gameId: string; version: number; payload: unknown } | null {
  const plugin = getGamePluginDefinition(gameId);

  if (!plugin) {
    return null;
  }

  return {
    gameId: plugin.id,
    version: 1,
    payload: plugin.serializeState(state),
  };
}

export function deserializePluginState(
  gameId: string,
  payload: unknown,
): unknown | null {
  const plugin = getGamePluginDefinition(gameId);

  if (!plugin) {
    return null;
  }

  return plugin.deserializeState(payload);
}
