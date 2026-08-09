import type { GamePluginDefinition } from '@wanasatna/shared';
import type { ServerGamePlugin, ServerRegisteredGamePlugin } from './plugin.types.js';

const plugins = new Map<string, ServerGamePlugin>();

export function registerGame(plugin: ServerGamePlugin): void {
  const gameId = plugin.definition.id;

  // Idempotent: safe if bootstrap retries after a partial failure.
  if (plugins.has(gameId)) {
    return;
  }

  plugins.set(gameId, plugin);
}

export function registerGameDefinition(definition: GamePluginDefinition): void {
  registerGame({ definition });
}

export function getGamePlugin(gameId: string): ServerGamePlugin | null {
  return plugins.get(gameId) ?? null;
}

export function getGamePluginDefinition(gameId: string): GamePluginDefinition | null {
  return plugins.get(gameId)?.definition ?? null;
}

export function listRegisteredGames(): ServerRegisteredGamePlugin[] {
  return [...plugins.entries()].map(([gameId, plugin]) => ({ gameId, plugin }));
}

export function hasGamePlugin(gameId: string): boolean {
  return plugins.has(gameId);
}
