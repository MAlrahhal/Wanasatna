/**
 * Temporary per-room next-round category selection (lobby mock → server).
 * Ready to be replaced by DB-backed room settings later.
 */
const nextCategoryByRoomId = new Map<string, string>();

export function setRoomRoundCategory(roomId: string, categoryId: string | null | undefined): void {
  if (!categoryId || categoryId === 'random') {
    nextCategoryByRoomId.delete(roomId);
    return;
  }

  nextCategoryByRoomId.set(roomId, categoryId);
}

export function getRoomRoundCategory(roomId: string): string | null {
  return nextCategoryByRoomId.get(roomId) ?? null;
}

export function clearRoomRoundCategory(roomId: string): void {
  nextCategoryByRoomId.delete(roomId);
}

/** Returns enabledCategoryIds filter for content word picking, or undefined for all. */
export function resolveEnabledCategoryFilter(roomId: string): string[] | undefined {
  const categoryId = getRoomRoundCategory(roomId);
  return categoryId ? [categoryId] : undefined;
}
