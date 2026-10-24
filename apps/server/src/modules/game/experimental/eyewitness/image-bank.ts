import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export type EyewitnessImageAsset = {
  id: string;
  fileName: string;
};

/** Provisional original closed-playtest image bank pending owner review. */
export const EYEWITNESS_IMAGE_BANK: readonly EyewitnessImageAsset[] = [
  { id: 'creature-rain-7kq', fileName: 'eyewitness-01.jpg' },
  { id: 'creature-chef-4vt', fileName: 'eyewitness-02.jpg' },
  { id: 'creature-juggler-9mp', fileName: 'eyewitness-03.jpg' },
  { id: 'creature-castle-2rx', fileName: 'eyewitness-04.jpg' },
  { id: 'creature-moon-8dw', fileName: 'eyewitness-05.jpg' },
  { id: 'creature-librarian-6ns', fileName: 'eyewitness-06.jpg' },
  { id: 'creature-skater-3hb', fileName: 'eyewitness-07.jpg' },
  { id: 'creature-crab-5fj', fileName: 'eyewitness-08.jpg' },
  { id: 'creature-kite-1zc', fileName: 'eyewitness-09.jpg' },
  { id: 'creature-explorer-7lg', fileName: 'eyewitness-10.jpg' },
  { id: 'creature-detective-4py', fileName: 'eyewitness-11.jpg' },
  { id: 'creature-cactus-9bt', fileName: 'eyewitness-12.jpg' },
  { id: 'creature-mushroom-2wk', fileName: 'eyewitness-13.jpg' },
  { id: 'creature-key-6qr', fileName: 'eyewitness-14.jpg' },
  { id: 'creature-teapots-3xm', fileName: 'eyewitness-15.jpg' },
] as const;

const cache = new Map<string, string>();

function readJpegDimensions(contents: Buffer): { width: number; height: number } | null {
  if (contents.length < 4 || contents[0] !== 0xff || contents[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 8 < contents.length) {
    if (contents[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = contents[offset + 1];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x00 || marker === 0xff) {
      offset += 1;
      continue;
    }

    const segmentLength = contents.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + segmentLength + 2 > contents.length) return null;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      return {
        height: contents.readUInt16BE(offset + 5),
        width: contents.readUInt16BE(offset + 7),
      };
    }

    offset += segmentLength + 2;
  }

  return null;
}

function resolveAssetPath(fileName: string): string {
  const sourceAdjacent = resolve(__dirname, 'assets', fileName);
  if (existsSync(sourceAdjacent)) return sourceAdjacent;

  const compiledFallback = resolve(
    __dirname,
    '../../../../../src/modules/game/experimental/eyewitness/assets',
    fileName,
  );
  if (existsSync(compiledFallback)) return compiledFallback;
  throw new Error('Eyewitness private image asset is unavailable.');
}

export function getEyewitnessImageDataUrl(imageId: string): string {
  const cached = cache.get(imageId);
  if (cached) return cached;
  const asset = EYEWITNESS_IMAGE_BANK.find((entry) => entry.id === imageId);
  if (!asset) throw new Error('Unknown Eyewitness image.');
  const encoded = readFileSync(resolveAssetPath(asset.fileName)).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${encoded}`;
  cache.set(imageId, dataUrl);
  return dataUrl;
}

export function validateEyewitnessImageBank(): {
  count: number;
  duplicateIds: string[];
  missingFiles: string[];
  invalidSizes: string[];
  invalidDimensions: string[];
} {
  const duplicateIds = EYEWITNESS_IMAGE_BANK.flatMap((entry, index, all) =>
    all.findIndex((candidate) => candidate.id === entry.id) === index ? [] : [entry.id],
  );
  const missingFiles: string[] = [];
  const invalidSizes: string[] = [];
  const invalidDimensions: string[] = [];
  for (const asset of EYEWITNESS_IMAGE_BANK) {
    try {
      const assetPath = resolveAssetPath(asset.fileName);
      const size = statSync(assetPath).size;
      if (size < 20_000 || size > 500_000) invalidSizes.push(asset.fileName);
      const dimensions = readJpegDimensions(readFileSync(assetPath));
      if (!dimensions || dimensions.width !== 768 || dimensions.height !== 768) {
        invalidDimensions.push(asset.fileName);
      }
    } catch {
      missingFiles.push(asset.fileName);
    }
  }
  return {
    count: EYEWITNESS_IMAGE_BANK.length,
    duplicateIds,
    missingFiles,
    invalidSizes,
    invalidDimensions,
  };
}
