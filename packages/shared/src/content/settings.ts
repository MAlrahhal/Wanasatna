/**
 * Default game settings shared across word-based and timed games.
 * Plugins may extend this per game; values come from content/settings.json.
 */
export type GameContentSettings = {
  minPlayers: number;
  maxPlayers: number;
  roundTime?: number;
  discussionTime?: number;
  countdownTime?: number;
  rounds?: number;
  enabledCategories: string[];
};

export type GameContentSettingsDocument = GameContentSettings;

export type LoadedGameContent<TSettings extends GameContentSettings = GameContentSettings> = {
  bundle: import('./types.js').GameContentBundle;
  settings: TSettings;
};
