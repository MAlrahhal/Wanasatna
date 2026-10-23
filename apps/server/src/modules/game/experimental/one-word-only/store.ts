import type { OneWordOnlyMatchState } from './state.js';

const matchesByRoomId = new Map<string, OneWordOnlyMatchState>();

export const getOneWordOnlyMatch = (roomId: string) => matchesByRoomId.get(roomId) ?? null;
export const setOneWordOnlyMatch = (roomId: string, match: OneWordOnlyMatchState) => {
  matchesByRoomId.set(roomId, match);
};
export const deleteOneWordOnlyMatch = (roomId: string) => matchesByRoomId.delete(roomId);
export const clearAllOneWordOnlyMatchesForTests = () => matchesByRoomId.clear();
