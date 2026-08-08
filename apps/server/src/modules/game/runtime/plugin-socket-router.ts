import type { Server, Socket } from 'socket.io';
import { listRegisteredGames } from './plugin-registry.js';

/**
 * Registers plugin socket handlers for every connected socket.
 * Each plugin owns its handler registration; the shell does not hardcode events.
 */
export function registerPluginSocketHandlers(io: Server, socket: Socket): void {
  for (const { plugin } of listRegisteredGames()) {
    plugin.registerSocketHandlers?.(io, socket);
  }
}
