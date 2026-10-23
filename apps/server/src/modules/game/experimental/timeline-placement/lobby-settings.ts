import { Prisma } from '@prisma/client';
import type { TimelinePlacementSettings } from '@wanasatna/shared';
import {
  TIMELINE_PLACEMENT_DEFAULT_SETTINGS,
  TIMELINE_PLACEMENT_ROUND_OPTIONS,
  TIMELINE_PLACEMENT_SELECTION_OPTIONS,
} from '@wanasatna/shared';

const PERSISTED_SETTINGS_KEY = '__timelinePlacementSettings';
const settingsByRoomId = new Map<string, TimelinePlacementSettings>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function allowed<T extends number>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'number' && values.includes(value as T);
}

export function validateTimelinePlacementSettings(
  payload: unknown,
): { success: true; data: TimelinePlacementSettings } | { success: false; error: string } {
  if (!isRecord(payload)) {
    return { success: false, error: 'إعدادات زمانها وين؟ غير صالحة.' };
  }
  const expectedKeys = ['roundCount', 'selectionSeconds'];
  if (
    Object.keys(payload).length !== expectedKeys.length ||
    Object.keys(payload).some((key) => !expectedKeys.includes(key))
  ) {
    return { success: false, error: 'تحتوي الإعدادات على حقول غير مسموحة.' };
  }
  if (!allowed(payload.roundCount, TIMELINE_PLACEMENT_ROUND_OPTIONS)) {
    return { success: false, error: 'عدد الجولات غير مسموح.' };
  }
  if (!allowed(payload.selectionSeconds, TIMELINE_PLACEMENT_SELECTION_OPTIONS)) {
    return { success: false, error: 'مدة الاختيار غير مسموحة.' };
  }
  return {
    success: true,
    data: { roundCount: payload.roundCount, selectionSeconds: payload.selectionSeconds },
  };
}

export function readPersistedTimelinePlacementSettings(
  gameSettings: unknown,
): TimelinePlacementSettings {
  if (!isRecord(gameSettings)) return { ...TIMELINE_PLACEMENT_DEFAULT_SETTINGS };
  const parsed = validateTimelinePlacementSettings(gameSettings[PERSISTED_SETTINGS_KEY]);
  return parsed.success ? parsed.data : { ...TIMELINE_PLACEMENT_DEFAULT_SETTINGS };
}

export function persistTimelinePlacementSettings(
  gameSettings: unknown,
  settings: TimelinePlacementSettings,
): Prisma.InputJsonObject {
  const base = isRecord(gameSettings) ? { ...gameSettings } : {};
  return {
    ...base,
    [PERSISTED_SETTINGS_KEY]: { ...settings },
  } as Prisma.InputJsonObject;
}

export function hydrateTimelinePlacementLobbySettings(roomId: string, gameSettings: unknown): void {
  settingsByRoomId.set(roomId, readPersistedTimelinePlacementSettings(gameSettings));
}

export function getTimelinePlacementLobbySettings(roomId: string): TimelinePlacementSettings {
  return { ...(settingsByRoomId.get(roomId) ?? TIMELINE_PLACEMENT_DEFAULT_SETTINGS) };
}

export function setTimelinePlacementLobbySettings(
  roomId: string,
  settings: TimelinePlacementSettings,
): void {
  settingsByRoomId.set(roomId, { ...settings });
}

export function clearTimelinePlacementLobbySettings(roomId: string): void {
  settingsByRoomId.delete(roomId);
}

export function clearAllTimelinePlacementLobbySettingsForTests(): void {
  settingsByRoomId.clear();
}
