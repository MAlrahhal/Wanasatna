import type { Server } from 'socket.io';
import { registerAllGameContent } from '../content/index.js';
import { registerAllGamePlugins } from './plugins/index.js';
import { listRegisteredGames, registerPluginSocketHandlers } from './runtime/index.js';
import { registerPregameTeamHandlers } from './pregame-teams.socket.js';
import { registerMarathonSocketHandlers } from '../marathon/marathon.socket.js';
import { env } from '../../config/env.js';
import { registerAllExperimentalGames } from './experimental/register-experimental-games.js';
import { registerExperimentalGameSelectionHandler } from './experimental/experimental-game.socket.js';
import {
  registerGameShellCancelCountdownHandler,
  registerGameShellEndHandler,
  registerGameShellInitHandler,
  registerGameShellResetHandler,
  registerGameShellReturnToLobbyHandler,
  registerGameShellSetReadyHandler,
  registerGameShellStartCountdownHandler,
  registerGameShellStartFromLobbyHandler,
  registerGameShellSyncHandler,
} from './game.socket.handlers.js';
let pluginsBootstrapped = false;

function ensureGameRuntimeRegistered(): void {
  if (pluginsBootstrapped) {
    return;
  }

  registerAllGameContent();
  registerAllGamePlugins();
  if (env.experimentalGamesEnabled) {
    registerAllExperimentalGames();
  }
  pluginsBootstrapped = true;

  console.info('[game-registry]', {
    stage: 'boot',
    games: listRegisteredGames().map(({ gameId }) => gameId),
  });
}

export function registerGameSockets(io: Server): void {
  ensureGameRuntimeRegistered();

  io.on('connection', (socket) => {
    registerGameShellInitHandler(io, socket);
    registerGameShellSyncHandler(io, socket);
    registerGameShellSetReadyHandler(io, socket);
    registerGameShellStartCountdownHandler(io, socket);
    registerGameShellCancelCountdownHandler(io, socket);
    registerGameShellEndHandler(io, socket);
    registerGameShellResetHandler(io, socket);
    registerGameShellStartFromLobbyHandler(io, socket);
    registerGameShellReturnToLobbyHandler(io, socket);
    registerExperimentalGameSelectionHandler(io, socket);
    registerPregameTeamHandlers(io, socket);
    registerMarathonSocketHandlers(io, socket);
    registerPluginSocketHandlers(io, socket);
  });
}
