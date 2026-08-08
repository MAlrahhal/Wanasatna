import type { GameContentWord } from '@wanasatna/shared';
import {
  IMPOSTER_DRAW_GAME_ID,
  buildImpostorGuessOptions,
  pickRandomWordFromCategories,
} from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { resolveEnabledCategoryFilter } from '../../runtime/round-category-store.js';

export function buildPlaceholderImageUrl(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#374151"/>
    </linearGradient>
  </defs>
  <rect width="480" height="360" fill="url(#g)"/>
  <rect x="24" y="24" width="432" height="312" rx="24" fill="#111827" stroke="#4b5563" stroke-width="3"/>
  <text x="240" y="175" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="700" fill="#f9fafb">${escapeXml(label)}</text>
  <text x="240" y="230" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#9ca3af">صورة مؤقتة</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function pickImposterDrawImage(roomId: string): GameContentWord {
  const content = getLoadedGameContent(IMPOSTER_DRAW_GAME_ID);

  if (!content) {
    throw new Error('Imposter Draw content is not loaded.');
  }

  const wordEntry = pickRandomWordFromCategories(
    content.bundle,
    resolveEnabledCategoryFilter(roomId) ?? content.settings.enabledCategories,
  );

  if (!wordEntry) {
    throw new Error('No images available for the selected categories.');
  }

  return wordEntry;
}

export function buildImageGuessOptions(imageLabel: string, categoryId: string): string[] {
  const content = getLoadedGameContent(IMPOSTER_DRAW_GAME_ID);

  if (!content) {
    return [imageLabel];
  }

  return buildImpostorGuessOptions(content.bundle, imageLabel, categoryId, 8);
}
