import {
  isPlayableGameId,
  type ExperimentalGameSummary,
  type GameShellPlayer,
} from '@wanasatna/shared';
import type { ServerGamePlugin } from '../runtime/plugin.types.js';
import type { Server } from 'socket.io';
import { registerGame } from '../runtime/plugin-registry.js';

export type ExperimentalGameRegistration = ExperimentalGameSummary & {
  plugin: ServerGamePlugin;
  resolveStartParticipantIds?: (
    roomId: string,
    players: readonly GameShellPlayer[],
  ) => readonly string[] | null;
  runtime?: {
    handlesActorRecovery?: boolean;
    hasState: (roomId: string) => boolean;
    initialize: (io: Server, roomId: string) => unknown;
    cleanup: (roomId: string) => void;
    reconcileConnectivity?: (io: Server, roomId: string) => void;
    onPermanentLeave?: (io: Server, roomId: string, playerId: string) => void;
  };
};

const registrations = new Map<string, ExperimentalGameRegistration>();
const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function registerExperimentalGame(registration: ExperimentalGameRegistration): void {
  const { gameId, plugin } = registration;
  if (!GAME_ID_PATTERN.test(gameId) || plugin.definition.id !== gameId) {
    throw new Error('Experimental game registration has an invalid or mismatched game ID.');
  }
  if (isPlayableGameId(gameId)) {
    throw new Error(`Experimental game "${gameId}" conflicts with a public game ID.`);
  }
  if (registration.minPlayers < 1 || registration.maxPlayers < registration.minPlayers) {
    throw new Error(`Experimental game "${gameId}" has an invalid player range.`);
  }

  const current = registrations.get(gameId);
  if (current) {
    if (current.plugin !== plugin) {
      throw new Error(`Experimental game "${gameId}" is already registered.`);
    }
    return;
  }

  registerGame(plugin);
  registrations.set(gameId, registration);
}

export function isRegisteredExperimentalGameId(gameId: string): boolean {
  return registrations.has(gameId);
}

export function listExperimentalGames(): ExperimentalGameSummary[] {
  return [...registrations.values()]
    .map(
      ({ plugin: _plugin, runtime: _runtime, resolveStartParticipantIds: _resolve, ...summary }) =>
        summary,
    )
    .sort((left, right) => left.gameId.localeCompare(right.gameId));
}

export function getExperimentalGameRegistration(
  gameId: string,
): ExperimentalGameRegistration | null {
  return registrations.get(gameId) ?? null;
}

export function clearExperimentalGameRegistryForTests(): void {
  registrations.clear();
}
