import type { GameActionResponse, GamePluginLifecycleContext, GameShellPlayer } from '@wanasatna/shared';
import { gameServiceError } from '../game.service.js';
import { getGamePluginDefinition } from './plugin-registry.js';

export function validateGameStart(
  gameId: string,
  roomId: string,
  hostPlayerId: string,
  players: GameShellPlayer[],
): Extract<GameActionResponse<never>, { success: false }> | null {
  const plugin = getGamePluginDefinition(gameId);

  if (!plugin) {
    console.info('[game-registry]', { stage: 'missing-plugin', gameId, roomId });
    return gameServiceError(
      'GAME_NOT_SELECTED',
      'هذه اللعبة غير متاحة على الخادم حالياً. حدّث الصفحة بعد لحظات ثم حاول مرة أخرى.',
    );
  }

  const lifecycleContext: GamePluginLifecycleContext = {
    roomId,
    shellId: '',
    gameId,
    hostPlayerId,
    players,
    phase: 'WAITING',
  };

  if (plugin.validateStart) {
    const result = plugin.validateStart(lifecycleContext, plugin.defaultSettings);

    if (!result.success) {
      return gameServiceError('VALIDATION_ERROR', result.error);
    }

    return null;
  }

  const connectedCount = players.filter((player) => player.isConnected).length;

  if (plugin.minPlayers !== undefined && connectedCount < plugin.minPlayers) {
    return gameServiceError(
      'VALIDATION_ERROR',
      `At least ${plugin.minPlayers} connected players are required.`,
    );
  }

  if (plugin.maxPlayers !== undefined && connectedCount > plugin.maxPlayers) {
    return gameServiceError(
      'VALIDATION_ERROR',
      `No more than ${plugin.maxPlayers} connected players are allowed.`,
    );
  }

  return null;
}
