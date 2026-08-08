/**
 * Plugin socket event naming convention.
 * Pattern: game-plugin:{gameId}:{action}
 *
 * The Game Shell routes events by gameId without knowing action semantics.
 */
export function pluginActionEvent(gameId: string, action: string): string {
  return `game-plugin:${gameId}:${action}`;
}

export function pluginStateEvent(gameId: string): string {
  return `game-plugin:${gameId}:state`;
}

export type GamePluginSocketEventMap = Record<string, string>;

export type GamePluginSocketDefinition = {
  /** Declarative map of logical action names to wire event names. */
  events: GamePluginSocketEventMap;
};
