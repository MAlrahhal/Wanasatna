import type { Server } from 'socket.io';
import { registerAllGameContent } from '../content/index.js';
import { registerAllGamePlugins } from './plugins/index.js';
import { registerPluginSocketHandlers } from './runtime/index.js';
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
  pluginsBootstrapped = true;
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
    registerPluginSocketHandlers(io, socket);
  });
}
