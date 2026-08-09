import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  GameContentBundle,
  GameContentCategory,
  GameContentQuestion,
  GameContentSettings,
  GameContentWord,
} from '@wanasatna/shared';

function resolveContentRoot(): string {
  let dir = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(dir, 'content');

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(dir);

    if (parent === dir) {
      break;
    }

    dir = parent;
  }

  throw new Error('Could not locate the repository content directory.');
}

const contentRoot = resolveContentRoot();

export function getContentRootPath(): string {
  return contentRoot;
}

export function loadGameContentBundle(gameId: string): GameContentBundle {
  const gameContentPath = join(contentRoot, gameId);

  const categories = JSON.parse(
    readFileSync(join(gameContentPath, 'categories.json'), 'utf8'),
  ) as GameContentCategory[];

  const words = JSON.parse(
    readFileSync(join(gameContentPath, 'words.json'), 'utf8'),
  ) as GameContentWord[];

  const questionsPath = join(gameContentPath, 'questions.json');
  const questions = existsSync(questionsPath)
    ? (JSON.parse(readFileSync(questionsPath, 'utf8')) as GameContentQuestion[])
    : undefined;

  return {
    gameId,
    categories,
    words,
    ...(questions ? { questions } : {}),
  };
}

export function loadGameContentSettings(gameId: string): GameContentSettings {
  const settings = JSON.parse(
    readFileSync(join(contentRoot, gameId, 'settings.json'), 'utf8'),
  ) as GameContentSettings;

  return {
    minPlayers: settings.minPlayers,
    maxPlayers: settings.maxPlayers,
    roundTime: settings.roundTime,
    discussionTime: settings.discussionTime,
    countdownTime: settings.countdownTime,
    rounds: settings.rounds,
    enabledCategories: settings.enabledCategories ?? [],
  };
}
