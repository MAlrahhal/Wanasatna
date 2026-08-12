import type { DrawGuessDrawerMode, DrawGuessLobbySettings } from '@wanasatna/shared';

export type DrawGuessRoomDrawerSettings = {
  drawerMode: DrawGuessDrawerMode;
  fixedPlayerId: string | null;
};

const settingsByRoomId = new Map<string, DrawGuessRoomDrawerSettings>();

export function setDrawGuessRoomDrawerSettings(
  roomId: string,
  settings: DrawGuessRoomDrawerSettings,
): void {
  settingsByRoomId.set(roomId, settings);
}

export function getDrawGuessRoomDrawerSettings(roomId: string): DrawGuessRoomDrawerSettings | null {
  return settingsByRoomId.get(roomId) ?? null;
}

export function clearDrawGuessRoomDrawerSettings(roomId: string): void {
  settingsByRoomId.delete(roomId);
}

export function applyDrawGuessLobbySettings(
  roomId: string,
  settingsInput: unknown,
  eligiblePlayerIds: readonly string[],
): { success: true; settings: DrawGuessRoomDrawerSettings } | { success: false; error: string } {
  const eligible = new Set(eligiblePlayerIds);

  if (!settingsInput || typeof settingsInput !== 'object') {
    const settings: DrawGuessRoomDrawerSettings = {
      drawerMode: 'random',
      fixedPlayerId: null,
    };
    setDrawGuessRoomDrawerSettings(roomId, settings);
    return { success: true, settings };
  }

  const data = settingsInput as Partial<DrawGuessLobbySettings>;
  const drawerMode = data.drawerMode;

  if (drawerMode !== 'random' && drawerMode !== 'fixed') {
    return { success: false, error: 'وضع اختيار الرسام غير صالح.' };
  }

  if (drawerMode === 'random') {
    const settings: DrawGuessRoomDrawerSettings = {
      drawerMode: 'random',
      fixedPlayerId: null,
    };
    setDrawGuessRoomDrawerSettings(roomId, settings);
    return { success: true, settings };
  }

  const fixedPlayerId =
    typeof data.fixedPlayerId === 'string' ? data.fixedPlayerId.trim() : '';

  if (!fixedPlayerId || !eligible.has(fixedPlayerId)) {
    return { success: false, error: 'يجب اختيار لاعب صالح ليكون الرسام.' };
  }

  const settings: DrawGuessRoomDrawerSettings = {
    drawerMode: 'fixed',
    fixedPlayerId,
  };
  setDrawGuessRoomDrawerSettings(roomId, settings);
  return { success: true, settings };
}
