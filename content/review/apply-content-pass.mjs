/**
 * Apply content cleanup + expansion on production JSON.
 * Run from repo root: node content/review/apply-content-pass.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALIAS_MAP } from './pass-alias-map.mjs';
import { NEW_CONTENT } from './pass-new-content.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENT = join(ROOT, 'content');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeDigit(digit) {
  const codePoint = digit.codePointAt(0) ?? 0;
  if (codePoint >= 0x0660 && codePoint <= 0x0669) return String(codePoint - 0x0660);
  if (codePoint >= 0x06f0 && codePoint <= 0x06f9) return String(codePoint - 0x06f0);
  return digit;
}

export function normalizeTextAnswer(value) {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[٠-٩۰-۹]/g, normalizeDigit)
    .replace(/\u0640/g, '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/^ال(?=[\p{L}\p{N}])/u, '')
    .replace(/[أإآٱا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[-–—]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookupAliases(value) {
  if (!value) return [];
  const exact = ALIAS_MAP[value];
  if (exact) return exact;
  const normalized = normalizeTextAnswer(value);
  return ALIAS_MAP[normalized] ?? [];
}

function uniqueAliases(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = normalizeTextAnswer(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function collectSeeds(item, kind) {
  if (kind === 'question' || kind === 'identity') {
    return [item.question, ...(item.acceptedAnswers ?? [])];
  }
  return [item.text, ...(item.aliases ?? [])];
}

function enrichItem(item, kind) {
  const extras = [];
  for (const seed of collectSeeds(item, kind)) {
    extras.push(...lookupAliases(seed));
  }
  if (kind === 'question' || kind === 'identity') {
    const merged = uniqueAliases([...(item.acceptedAnswers ?? []), ...extras]);
    if (kind === 'identity') {
      const canonical = item.question.trim();
      const hasCanonical = merged.some(
        (answer) => normalizeTextAnswer(answer) === normalizeTextAnswer(canonical),
      );
      item.acceptedAnswers = hasCanonical ? merged : uniqueAliases([canonical, ...merged]);
    } else {
      item.acceptedAnswers = merged;
    }
    return;
  }
  const merged = uniqueAliases([item.text, ...(item.aliases ?? []), ...extras]).filter(
    (value) => normalizeTextAnswer(value) !== normalizeTextAnswer(item.text),
  );
  if (merged.length > 0) {
    item.aliases = merged;
  } else {
    delete item.aliases;
  }
}

function resolveCategoryCollisions(items, kind) {
  const owners = new Map();

  function keysOf(item) {
    const values =
      kind === 'question' || kind === 'identity'
        ? item.acceptedAnswers ?? []
        : [item.text, ...(item.aliases ?? [])];
    return values.map((value) => normalizeTextAnswer(value)).filter(Boolean);
  }

  for (const item of items) {
    for (const key of keysOf(item)) {
      const scoped = `${item.categoryId}\0${key}`;
      if (!owners.has(scoped)) owners.set(scoped, item.id);
    }
  }

  for (const item of items) {
    if (kind === 'question' || kind === 'identity') {
      item.acceptedAnswers = (item.acceptedAnswers ?? []).filter((answer) => {
        const key = normalizeTextAnswer(answer);
        return !key || owners.get(`${item.categoryId}\0${key}`) === item.id;
      });
      if (kind === 'identity') {
        const canonical = item.question.trim();
        const hasCanonical = item.acceptedAnswers.some(
          (answer) => normalizeTextAnswer(answer) === normalizeTextAnswer(canonical),
        );
        if (!hasCanonical) {
          item.acceptedAnswers = uniqueAliases([canonical, ...item.acceptedAnswers]);
        }
      }
    } else {
      const aliases = (item.aliases ?? []).filter((alias) => {
        const key = normalizeTextAnswer(alias);
        return !key || owners.get(`${item.categoryId}\0${key}`) === item.id;
      });
      if (aliases.length > 0) item.aliases = aliases;
      else delete item.aliases;
    }
  }
}

function applyPatches(gameId, items, kind) {
  const byId = new Map(items.map((item) => [item.id, item]));

  if (gameId === 'fast-answer') {
    const britainLandmark = byId.get('countries-18');
    if (britainLandmark) {
      britainLandmark.question = 'ما الدولة التي تشتهر بالكنغر؟';
      britainLandmark.acceptedAnswers = ['أستراليا', 'استراليا', 'Australia'];
    }
    const lostIsland = byId.get('series-20');
    if (lostIsland) {
      lostIsland.question = 'ما اسم المسلسل الذي تسقط فيه رحلة Oceanic 815؟';
      lostIsland.acceptedAnswers = ['Lost', 'لوست'];
    }
    const battleRoyale = byId.get('games-2');
    if (battleRoyale) {
      battleRoyale.question = 'ما لعبة الباتل رويال التي تشتهر بخريطة إيرنغل والنزول من طائرة؟';
      battleRoyale.acceptedAnswers = ['PUBG', 'ببجي', "PlayerUnknown's Battlegrounds"];
    }
  }

  if (gameId === 'guessing-challenge') {
    const oman = byId.get('countries-8');
    if (oman) {
      oman.acceptedAnswers = ['عُمان', 'عمان', 'سلطنة عمان', 'Oman'];
    }
  }

  if (gameId === 'draw-guess') {
    const island = byId.get('nature-19');
    if (island) {
      delete island.aliases;
    }
  }
}

function mergeNewItems(existing, incoming, idField = 'id') {
  const seen = new Set(existing.map((item) => item[idField]));
  const next = [...existing];
  for (const item of incoming) {
    if (seen.has(item[idField])) {
      throw new Error(`Refusing to overwrite existing id ${item[idField]}`);
    }
    seen.add(item[idField]);
    next.push(item);
  }
  return next;
}

const QUESTION_GAMES = new Set(['fast-answer', 'guessing-challenge']);

function processGame(gameId) {
  const dir = join(CONTENT, gameId);
  const kind = QUESTION_GAMES.has(gameId)
    ? gameId === 'guessing-challenge'
      ? 'identity'
      : 'question'
    : 'word';
  const fileName = QUESTION_GAMES.has(gameId) ? 'questions.json' : 'words.json';
  const items = readJson(join(dir, fileName));
  applyPatches(gameId, items, kind);
  const incoming = NEW_CONTENT[gameId] ?? [];
  const merged = mergeNewItems(items, incoming);
  for (const item of merged) enrichItem(item, kind);
  resolveCategoryCollisions(merged, kind);
  writeJson(join(dir, fileName), merged);
  return { gameId, before: items.length, added: incoming.length, after: merged.length };
}

const results = [
  'bara-al-salafa',
  'draw-guess',
  'imposter-draw',
  'fast-answer',
  'who-wrote-it',
  'judge',
  'guessing-challenge',
].map(processGame);

console.log(JSON.stringify(results, null, 2));
