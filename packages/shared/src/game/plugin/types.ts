import type { GamePhase } from '../enums.js';
import type { GameShellPlayer } from '../player.js';

export type GamePluginMetadata = {
  id: string;
  title: string;
  description: string;
  iconLabel: string;
  minPlayers?: number;
  maxPlayers?: number;
};

export type GamePluginSettingsField = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  defaultValue: string;
  options?: Array<{ value: string; label: string }>;
};

export type GamePluginSettingValue = string | number | boolean | string[];

export type GamePluginSettings = Record<string, GamePluginSettingValue>;

export type GamePluginLifecycleContext = {
  roomId: string;
  shellId: string;
  gameId: string;
  hostPlayerId: string;
  players: GameShellPlayer[];
  phase: GamePhase;
};

export type GamePluginValidationResult =
  | { success: true }
  | { success: false; error: string };

export type GamePluginSettingsValidationResult<TSettings extends GamePluginSettings = GamePluginSettings> =
  | { success: true; data: TSettings }
  | { success: false; error: string };
