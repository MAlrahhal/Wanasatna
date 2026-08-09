import type { GameContentBundle, GameContentSettings, LoadedGameContent } from '@wanasatna/shared';
import { validateContentBundle } from '@wanasatna/shared';
import { loadGameContentBundle, loadGameContentSettings } from './loader.js';

const bundlesByGameId = new Map<string, GameContentBundle>();
const settingsByGameId = new Map<string, GameContentSettings>();

export function registerGameContent(gameId: string): LoadedGameContent {
  const bundle = loadGameContentBundle(gameId);
  const settings = loadGameContentSettings(gameId);

  const validation = validateContentBundle(bundle);

  if (!validation.valid) {
    throw new Error(
      `Invalid content for "${gameId}": ${validation.errors.join(' ')}`,
    );
  }

  bundlesByGameId.set(gameId, bundle);
  settingsByGameId.set(gameId, settings);

  return { bundle, settings };
}

export function getGameContentBundle(gameId: string): GameContentBundle | null {
  return bundlesByGameId.get(gameId) ?? null;
}

export function getGameContentSettings(gameId: string): GameContentSettings | null {
  return settingsByGameId.get(gameId) ?? null;
}

export function getLoadedGameContent(gameId: string): LoadedGameContent | null {
  const bundle = getGameContentBundle(gameId);
  const settings = getGameContentSettings(gameId);

  if (!bundle || !settings) {
    return null;
  }

  return { bundle, settings };
}

export function registerAllGameContent(): void {
  registerGameContent('bara-al-salafa');
  registerGameContent('draw-guess');
  registerGameContent('imposter-draw');
  registerGameContent('fast-answer');
}

export function listRegisteredContentGameIds(): string[] {
  return [...bundlesByGameId.keys()];
}
