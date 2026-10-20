import { Prisma } from '@prisma/client';
import { getExperimentalGameRegistration } from './experimental-game.registry.js';

export type ExperimentalGameSelection = {
  gameId: string;
  hostPlayerId: string;
  adminUserId: string;
};

const PERSISTED_SELECTION_KEY = '__experimentalGameSelection';
const selectionsByRoomId = new Map<string, ExperimentalGameSelection>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function readPersistedExperimentalGameSelection(
  gameSettings: unknown,
): ExperimentalGameSelection | null {
  if (!isRecord(gameSettings)) return null;
  const value = gameSettings[PERSISTED_SELECTION_KEY];
  if (!isRecord(value)) return null;
  const { gameId, hostPlayerId, adminUserId } = value;
  if (
    typeof gameId !== 'string' ||
    typeof hostPlayerId !== 'string' ||
    typeof adminUserId !== 'string' ||
    !gameId ||
    !hostPlayerId ||
    !adminUserId
  ) {
    return null;
  }
  return { gameId, hostPlayerId, adminUserId };
}

export function persistExperimentalGameSelection(
  gameSettings: unknown,
  selection: ExperimentalGameSelection,
): Prisma.InputJsonObject {
  const base = isRecord(gameSettings) ? { ...gameSettings } : {};
  return {
    ...base,
    [PERSISTED_SELECTION_KEY]: {
      gameId: selection.gameId,
      hostPlayerId: selection.hostPlayerId,
      adminUserId: selection.adminUserId,
    },
  } as Prisma.InputJsonObject;
}

export function removePersistedExperimentalGameSelection(
  gameSettings: unknown,
): Prisma.InputJsonObject | typeof Prisma.JsonNull {
  if (!isRecord(gameSettings)) return Prisma.JsonNull;
  const next = { ...gameSettings };
  delete next[PERSISTED_SELECTION_KEY];
  return Object.keys(next).length > 0 ? (next as Prisma.InputJsonObject) : Prisma.JsonNull;
}

export function hydrateExperimentalGameSelection(roomId: string, gameSettings: unknown): void {
  const selection = readPersistedExperimentalGameSelection(gameSettings);
  if (selection) selectionsByRoomId.set(roomId, selection);
  else selectionsByRoomId.delete(roomId);
}

export function getExperimentalGameSelection(roomId: string): ExperimentalGameSelection | null {
  return selectionsByRoomId.get(roomId) ?? null;
}

export function setExperimentalGameSelection(
  roomId: string,
  selection: ExperimentalGameSelection,
): void {
  selectionsByRoomId.set(roomId, selection);
}

export function clearExperimentalGameSelection(roomId: string): void {
  const selection = selectionsByRoomId.get(roomId);
  if (selection) {
    getExperimentalGameRegistration(selection.gameId)?.runtime?.cleanup(roomId);
  }
  forgetExperimentalGameSelection(roomId);
}

export function forgetExperimentalGameSelection(roomId: string): void {
  selectionsByRoomId.delete(roomId);
}

export function clearAllExperimentalGameSelectionsForTests(): void {
  selectionsByRoomId.clear();
}
