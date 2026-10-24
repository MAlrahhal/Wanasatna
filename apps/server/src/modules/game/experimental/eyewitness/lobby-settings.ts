import { Prisma } from '@prisma/client';
import type { EyewitnessSettings } from '@wanasatna/shared';
import {
  EYEWITNESS_DEFAULT_SETTINGS,
  EYEWITNESS_DESCRIPTION_SECONDS_OPTIONS,
  EYEWITNESS_DRAWING_SECONDS_OPTIONS,
  EYEWITNESS_ROUND_OPTIONS,
  EYEWITNESS_VOTING_SECONDS_OPTIONS,
} from '@wanasatna/shared';

const PERSISTED_SETTINGS_KEY = '__eyewitnessSettings';
const settingsByRoomId = new Map<string, EyewitnessSettings>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateEyewitnessSettings(
  payload: unknown,
): { success: true; data: EyewitnessSettings } | { success: false; error: string } {
  if (!isRecord(payload)) return { success: false, error: 'إعدادات اللعبة غير صالحة.' };
  const keys = Object.keys(payload);
  const expected = ['roundCount', 'descriptionSeconds', 'drawingSeconds', 'votingSeconds'];
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) {
    return { success: false, error: 'تحتوي الإعدادات على حقول غير مسموحة.' };
  }
  if (
    typeof payload.roundCount !== 'number' ||
    !EYEWITNESS_ROUND_OPTIONS.includes(payload.roundCount as never)
  )
    return { success: false, error: 'عدد الجولات غير مسموح.' };
  if (
    typeof payload.descriptionSeconds !== 'number' ||
    !EYEWITNESS_DESCRIPTION_SECONDS_OPTIONS.includes(payload.descriptionSeconds as never)
  )
    return { success: false, error: 'مدة مشاهدة الصورة والوصف غير مسموحة.' };
  if (
    typeof payload.drawingSeconds !== 'number' ||
    !EYEWITNESS_DRAWING_SECONDS_OPTIONS.includes(payload.drawingSeconds as never)
  )
    return { success: false, error: 'مدة الرسم غير مسموحة.' };
  if (
    typeof payload.votingSeconds !== 'number' ||
    !EYEWITNESS_VOTING_SECONDS_OPTIONS.includes(payload.votingSeconds as never)
  )
    return { success: false, error: 'مدة التصويت غير مسموحة.' };
  return {
    success: true,
    data: {
      roundCount: payload.roundCount as EyewitnessSettings['roundCount'],
      descriptionSeconds: payload.descriptionSeconds as EyewitnessSettings['descriptionSeconds'],
      drawingSeconds: payload.drawingSeconds as EyewitnessSettings['drawingSeconds'],
      votingSeconds: payload.votingSeconds as EyewitnessSettings['votingSeconds'],
    },
  };
}

export function readPersistedEyewitnessSettings(gameSettings: unknown): EyewitnessSettings {
  if (!isRecord(gameSettings)) return { ...EYEWITNESS_DEFAULT_SETTINGS };
  const parsed = validateEyewitnessSettings(gameSettings[PERSISTED_SETTINGS_KEY]);
  return parsed.success ? parsed.data : { ...EYEWITNESS_DEFAULT_SETTINGS };
}

export function persistEyewitnessSettings(
  gameSettings: unknown,
  settings: EyewitnessSettings,
): Prisma.InputJsonObject {
  const base = isRecord(gameSettings) ? { ...gameSettings } : {};
  return { ...base, [PERSISTED_SETTINGS_KEY]: { ...settings } } as Prisma.InputJsonObject;
}

export const hydrateEyewitnessLobbySettings = (roomId: string, gameSettings: unknown) => {
  settingsByRoomId.set(roomId, readPersistedEyewitnessSettings(gameSettings));
};
export const getEyewitnessLobbySettings = (roomId: string): EyewitnessSettings => ({
  ...(settingsByRoomId.get(roomId) ?? EYEWITNESS_DEFAULT_SETTINGS),
});
export const setEyewitnessLobbySettings = (roomId: string, settings: EyewitnessSettings) => {
  settingsByRoomId.set(roomId, { ...settings });
};
export const clearEyewitnessLobbySettings = (roomId: string) => settingsByRoomId.delete(roomId);
export const clearAllEyewitnessLobbySettingsForTests = () => settingsByRoomId.clear();
