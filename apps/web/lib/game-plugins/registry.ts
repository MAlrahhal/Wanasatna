import type { WebClientGamePlugin } from './types';

const plugins = new Map<string, WebClientGamePlugin>();

export function registerGame(plugin: WebClientGamePlugin): void {
  const gameId = plugin.metadata.id;

  if (plugins.has(gameId)) {
    throw new Error(`Client game plugin "${gameId}" is already registered.`);
  }

  plugins.set(gameId, plugin);
}

export function getClientGamePlugin(gameId: string): WebClientGamePlugin | null {
  return plugins.get(gameId) ?? null;
}

export function listClientGamePlugins(): WebClientGamePlugin[] {
  return [...plugins.values()];
}

export function hasClientGamePlugin(gameId: string): boolean {
  return plugins.has(gameId);
}
