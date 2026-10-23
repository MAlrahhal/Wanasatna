import { Prisma } from '@prisma/client';
import type { OneWordOnlySettings } from '@wanasatna/shared';
import {
  ONE_WORD_ONLY_CLUE_SECONDS_OPTIONS,
  ONE_WORD_ONLY_DEFAULT_SETTINGS,
  ONE_WORD_ONLY_GUESS_SECONDS_OPTIONS,
  ONE_WORD_ONLY_ROUND_OPTIONS,
} from '@wanasatna/shared';

const PERSISTED_SETTINGS_KEY = '__oneWordOnlySettings';
const settingsByRoomId = new Map<string, OneWordOnlySettings>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateOneWordOnlySettings(
  payload: unknown,
): { success: true; data: OneWordOnlySettings } | { success: false; error: string } {
  if (!isRecord(payload)) return { success: false, error: 'إعدادات اللعبة غير صالحة.' };
  const keys = Object.keys(payload);
  const expected = ['roundCount', 'clueSeconds', 'guessSeconds'];
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
    return { success: false, error: 'تحتوي الإعدادات على حقول غير مسموحة.' };
  }
  if (
    typeof payload.roundCount !== 'number' ||
    !ONE_WORD_ONLY_ROUND_OPTIONS.includes(payload.roundCount as never)
  )
    return { success: false, error: 'عدد الجولات غير مسموح.' };
  if (
    typeof payload.clueSeconds !== 'number' ||
    !ONE_WORD_ONLY_CLUE_SECONDS_OPTIONS.includes(payload.clueSeconds as never)
  )
    return { success: false, error: 'مدة كتابة التلميح غير مسموحة.' };
  if (
    typeof payload.guessSeconds !== 'number' ||
    !ONE_WORD_ONLY_GUESS_SECONDS_OPTIONS.includes(payload.guessSeconds as never)
  )
    return { success: false, error: 'مدة التخمين غير مسموحة.' };
  return {
    success: true,
    data: {
      roundCount: payload.roundCount as OneWordOnlySettings['roundCount'],
      clueSeconds: payload.clueSeconds as OneWordOnlySettings['clueSeconds'],
      guessSeconds: payload.guessSeconds as OneWordOnlySettings['guessSeconds'],
    },
  };
}

export function readPersistedOneWordOnlySettings(gameSettings: unknown): OneWordOnlySettings {
  if (!isRecord(gameSettings)) return { ...ONE_WORD_ONLY_DEFAULT_SETTINGS };
  const parsed = validateOneWordOnlySettings(gameSettings[PERSISTED_SETTINGS_KEY]);
  return parsed.success ? parsed.data : { ...ONE_WORD_ONLY_DEFAULT_SETTINGS };
}

export function persistOneWordOnlySettings(
  gameSettings: unknown,
  settings: OneWordOnlySettings,
): Prisma.InputJsonObject {
  const base = isRecord(gameSettings) ? { ...gameSettings } : {};
  return { ...base, [PERSISTED_SETTINGS_KEY]: { ...settings } } as Prisma.InputJsonObject;
}

export const hydrateOneWordOnlyLobbySettings = (roomId: string, gameSettings: unknown) => {
  settingsByRoomId.set(roomId, readPersistedOneWordOnlySettings(gameSettings));
};
export const getOneWordOnlyLobbySettings = (roomId: string): OneWordOnlySettings => ({
  ...(settingsByRoomId.get(roomId) ?? ONE_WORD_ONLY_DEFAULT_SETTINGS),
});
export const setOneWordOnlyLobbySettings = (roomId: string, settings: OneWordOnlySettings) => {
  settingsByRoomId.set(roomId, { ...settings });
};
export const clearOneWordOnlyLobbySettings = (roomId: string) => settingsByRoomId.delete(roomId);
export const clearAllOneWordOnlyLobbySettingsForTests = () => settingsByRoomId.clear();
