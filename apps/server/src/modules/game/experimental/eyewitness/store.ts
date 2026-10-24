import type { EyewitnessMatchState } from './state.js';

const matchesByRoomId = new Map<string, EyewitnessMatchState>();

export const getEyewitnessMatch = (roomId: string) => matchesByRoomId.get(roomId) ?? null;
export const setEyewitnessMatch = (roomId: string, match: EyewitnessMatchState) => {
  matchesByRoomId.set(roomId, match);
};
export const deleteEyewitnessMatch = (roomId: string) => matchesByRoomId.delete(roomId);
export const clearAllEyewitnessMatchesForTests = () => matchesByRoomId.clear();
