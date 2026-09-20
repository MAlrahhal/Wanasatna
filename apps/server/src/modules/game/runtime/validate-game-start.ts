import {
  GUESSING_CHALLENGE_GAME_ID,
  type GameActionResponse,
  type GamePluginLifecycleContext,
  type GameShellPlayer,
} from '@wanasatna/shared';
import { gameServiceError } from '../game.service.js';
import { getGuessingChallengeRoomMode } from '../plugins/guessing-challenge/mode-store.js';
import { validatePregameTeamsForStart } from './pregame-teams.service.js';
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
  }

  if (!plugin.validateStart) {
    const connectedCount = players.filter(
      (player) => player.isConnected && !player.isSpectator,
    ).length;

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
  }

  if (gameId === GUESSING_CHALLENGE_GAME_ID) {
    const teamValidation = validatePregameTeamsForStart({
      roomId,
      gameId,
      mode: getGuessingChallengeRoomMode(roomId) ?? '1v1',
      eligiblePlayerIds: players
        .filter((player) => player.isConnected && !player.isSpectator)
        .map((player) => player.id),
    });
    if (!teamValidation.success) {
      return teamValidation;
    }
  }

  return null;
}
