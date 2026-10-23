import { Prisma } from '@prisma/client';
import type { EmojiLanguageSettings } from '@wanasatna/shared';
import {
  EMOJI_LANGUAGE_DEFAULT_SETTINGS,
  EMOJI_LANGUAGE_GUESSING_OPTIONS,
  EMOJI_LANGUAGE_PREPARATION_OPTIONS,
  EMOJI_LANGUAGE_ROUND_OPTIONS,
} from '@wanasatna/shared';

const PERSISTED_SETTINGS_KEY = '__emojiLanguageSettings';
const settingsByRoomId = new Map<string, EmojiLanguageSettings>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAllowedNumber<T extends number>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'number' && values.includes(value as T);
}

export function validateEmojiLanguageSettings(
  payload: unknown,
): { success: true; data: EmojiLanguageSettings } | { success: false; error: string } {
  if (!isRecord(payload)) {
    return { success: false, error: 'إعدادات لغة الإيموجي غير صالحة.' };
  }
  const expectedKeys = ['mode', 'roundCount', 'preparationSeconds', 'guessingSeconds'];
  if (
    Object.keys(payload).length !== expectedKeys.length ||
    Object.keys(payload).some((key) => !expectedKeys.includes(key))
  ) {
    return { success: false, error: 'تحتوي الإعدادات على حقول غير مسموحة.' };
  }
  if (payload.mode !== 'player-clue' && payload.mode !== 'server-puzzle') {
    return { success: false, error: 'وضع اللعب غير صالح.' };
  }
  if (!isAllowedNumber(payload.roundCount, EMOJI_LANGUAGE_ROUND_OPTIONS)) {
    return { success: false, error: 'عدد الجولات غير مسموح.' };
  }
  if (!isAllowedNumber(payload.preparationSeconds, EMOJI_LANGUAGE_PREPARATION_OPTIONS)) {
    return { success: false, error: 'مدة إعداد التلميح غير مسموحة.' };
  }
  if (!isAllowedNumber(payload.guessingSeconds, EMOJI_LANGUAGE_GUESSING_OPTIONS)) {
    return { success: false, error: 'مدة التخمين غير مسموحة.' };
  }
  return {
    success: true,
    data: {
      mode: payload.mode,
      roundCount: payload.roundCount,
      preparationSeconds: payload.preparationSeconds,
      guessingSeconds: payload.guessingSeconds,
    },
  };
}

export function readPersistedEmojiLanguageSettings(gameSettings: unknown): EmojiLanguageSettings {
  if (!isRecord(gameSettings)) return { ...EMOJI_LANGUAGE_DEFAULT_SETTINGS };
  const parsed = validateEmojiLanguageSettings(gameSettings[PERSISTED_SETTINGS_KEY]);
  return parsed.success ? parsed.data : { ...EMOJI_LANGUAGE_DEFAULT_SETTINGS };
}

export function persistEmojiLanguageSettings(
  gameSettings: unknown,
  settings: EmojiLanguageSettings,
): Prisma.InputJsonObject {
  const base = isRecord(gameSettings) ? { ...gameSettings } : {};
  return {
    ...base,
    [PERSISTED_SETTINGS_KEY]: { ...settings },
  } as Prisma.InputJsonObject;
}

export function hydrateEmojiLanguageLobbySettings(roomId: string, gameSettings: unknown): void {
  settingsByRoomId.set(roomId, readPersistedEmojiLanguageSettings(gameSettings));
}

export function getEmojiLanguageLobbySettings(roomId: string): EmojiLanguageSettings {
  return { ...(settingsByRoomId.get(roomId) ?? EMOJI_LANGUAGE_DEFAULT_SETTINGS) };
}

export function setEmojiLanguageLobbySettings(
  roomId: string,
  settings: EmojiLanguageSettings,
): void {
  settingsByRoomId.set(roomId, { ...settings });
}

export function clearEmojiLanguageLobbySettings(roomId: string): void {
  settingsByRoomId.delete(roomId);
}

export function clearAllEmojiLanguageLobbySettingsForTests(): void {
  settingsByRoomId.clear();
}
