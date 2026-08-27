import {
  ADMIN_GAME_SETTING_SPECS,
  MARATHON_MAX_GAMES,
  MARATHON_MIN_GAMES,
  isMarathonGameId,
  type MarathonGamePlanItem,
} from '@wanasatna/shared';
import { loadGameContentBundle } from '../content/loader.js';

export type MarathonPlanValidation =
  { success: true; plan: MarathonGamePlanItem[] } | { success: false; message: string };

export function validateMarathonPlan(raw: unknown): MarathonPlanValidation {
  if (!Array.isArray(raw) || raw.length < MARATHON_MIN_GAMES || raw.length > MARATHON_MAX_GAMES) {
    return { success: false, message: 'اختر من لعبتين إلى 7 ألعاب للماراتون.' };
  }

  const seen = new Set<string>();
  const plan: MarathonGamePlanItem[] = [];

  for (const rawItem of raw) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      return { success: false, message: 'خطة الماراتون غير صالحة.' };
    }
    const item = rawItem as Record<string, unknown>;
    if (typeof item.gameId !== 'string' || !isMarathonGameId(item.gameId)) {
      return { success: false, message: 'تحتوي الخطة على لعبة غير مدعومة في الماراتون.' };
    }
    if (seen.has(item.gameId)) {
      return { success: false, message: 'لا يمكن تكرار اللعبة في الماراتون.' };
    }
    seen.add(item.gameId);

    const rawConfiguration =
      item.configuration &&
      typeof item.configuration === 'object' &&
      !Array.isArray(item.configuration)
        ? (item.configuration as Record<string, unknown>)
        : {};
    const rawSettings =
      rawConfiguration.settings && typeof rawConfiguration.settings === 'object'
        ? (rawConfiguration.settings as Record<string, unknown>)
        : {};
    const settings: Record<string, number> = {};
    for (const spec of ADMIN_GAME_SETTING_SPECS[item.gameId] ?? []) {
      const value = rawSettings[spec.key];
      if (value === undefined) {
        continue;
      }
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        (value < spec.min && !(item.gameId === 'judge' && spec.key === 'rounds' && value === 0)) ||
        value > spec.max
      ) {
        return { success: false, message: `إعداد ${spec.label} غير صالح.` };
      }
      settings[spec.key] = value;
    }

    const categoryId =
      typeof rawConfiguration.categoryId === 'string'
        ? rawConfiguration.categoryId.trim() || null
        : null;
    if (item.gameId === 'timing-challenge' && categoryId !== null) {
      return { success: false, message: 'هذه اللعبة لا تستخدم فئات.' };
    }
    if (item.gameId !== 'timing-challenge' && categoryId !== null) {
      const validCategoryIds = new Set([
        'random',
        ...loadGameContentBundle(item.gameId).categories.map((category) => category.id),
      ]);
      if (!validCategoryIds.has(categoryId)) {
        return { success: false, message: 'فئة اللعبة غير صالحة.' };
      }
    }
    const configuration: MarathonGamePlanItem['configuration'] = { categoryId, settings };

    if (item.gameId === 'timing-challenge') {
      const timing = rawConfiguration.timingChallenge as Record<string, unknown> | undefined;
      if (
        !timing ||
        (timing.mode !== 'guess-time' && timing.mode !== 'stop-timer') ||
        typeof timing.minSeconds !== 'number' ||
        typeof timing.maxSeconds !== 'number' ||
        timing.minSeconds < 1 ||
        timing.maxSeconds > 60 ||
        timing.minSeconds >= timing.maxSeconds
      ) {
        return { success: false, message: 'إعدادات تحدي التوقيت غير صالحة.' };
      }
      if (
        (settings.minSeconds !== undefined && settings.minSeconds !== timing.minSeconds) ||
        (settings.maxSeconds !== undefined && settings.maxSeconds !== timing.maxSeconds)
      ) {
        return { success: false, message: 'إعدادات وقت اللعبة غير متطابقة.' };
      }
      configuration.timingChallenge = {
        mode: timing.mode,
        minSeconds: timing.minSeconds,
        maxSeconds: timing.maxSeconds,
      };
    }

    if (item.gameId === 'draw-guess') {
      const drawing = rawConfiguration.drawGuess as Record<string, unknown> | undefined;
      if (
        !drawing ||
        (drawing.drawerMode !== 'random' && drawing.drawerMode !== 'fixed') ||
        (drawing.drawerMode === 'fixed' &&
          (typeof drawing.fixedPlayerId !== 'string' || !drawing.fixedPlayerId.trim()))
      ) {
        return { success: false, message: 'إعدادات الرسام غير صالحة.' };
      }
      configuration.drawGuess = {
        drawerMode: drawing.drawerMode,
        ...(typeof drawing.fixedPlayerId === 'string'
          ? { fixedPlayerId: drawing.fixedPlayerId }
          : {}),
      };
    }

    plan.push({ gameId: item.gameId, configuration });
  }

  return { success: true, plan };
}
