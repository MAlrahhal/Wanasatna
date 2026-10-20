export type ExperimentalGameSelection = {
  gameId: string;
  hostPlayerId: string;
  adminUserId: string;
};

const selectionsByRoomId = new Map<string, ExperimentalGameSelection>();

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
  selectionsByRoomId.delete(roomId);
}

export function clearAllExperimentalGameSelectionsForTests(): void {
  selectionsByRoomId.clear();
}
import { getExperimentalGameRegistration } from './experimental-game.registry.js';
