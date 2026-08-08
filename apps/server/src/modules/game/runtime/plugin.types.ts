import type { Server, Socket } from 'socket.io';
import type { GamePluginDefinition } from '@wanasatna/shared';

/**
 * Server-side extension of the shared plugin contract.
 * Socket handlers are registered by the runtime, not the shell.
 */
export type ServerGamePluginHandlerContext = {
  io: Server;
  socket: Socket;
  roomId: string;
  playerId: string;
  shellId: string;
};

export type ServerGamePluginHandler = (
  context: ServerGamePluginHandlerContext,
  payload: unknown,
  callback?: (response: unknown) => void,
) => Promise<void> | void;

export type ServerGamePluginSocketHandlers = Record<string, ServerGamePluginHandler>;

export type ServerGamePlugin = {
  definition: GamePluginDefinition;
  registerSocketHandlers?: (io: Server, socket: Socket) => void;
};

export type ServerRegisteredGamePlugin = {
  gameId: string;
  plugin: ServerGamePlugin;
};
