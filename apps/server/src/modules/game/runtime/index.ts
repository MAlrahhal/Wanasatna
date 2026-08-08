export { registerGame, registerGameDefinition, getGamePlugin, getGamePluginDefinition, listRegisteredGames, hasGamePlugin } from './plugin-registry.js';
export { validateGameStart } from './validate-game-start.js';
export { invokePluginLifecycleHook, serializePluginState, deserializePluginState } from './plugin-lifecycle-bridge.js';
export { registerPluginSocketHandlers } from './plugin-socket-router.js';
export type { ServerGamePlugin, ServerRegisteredGamePlugin } from './plugin.types.js';
