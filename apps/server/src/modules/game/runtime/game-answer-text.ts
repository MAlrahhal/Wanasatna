import { MAX_GAME_ANSWER_LENGTH } from '@wanasatna/shared';

export { MAX_GAME_ANSWER_LENGTH };

export function isOversizedGameAnswer(raw: string): boolean {
  return raw.trim().length > MAX_GAME_ANSWER_LENGTH;
}
