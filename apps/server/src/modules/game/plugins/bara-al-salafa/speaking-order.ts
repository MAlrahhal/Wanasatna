import type { BaraAlSalafaDirectedQuestionPair } from '@wanasatna/shared';

export class DirectedQuestionPairsBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DirectedQuestionPairsBuildError';
  }
}

export function shufflePlayerIds(playerIds: string[]): string[] {
  const shuffled = [...playerIds];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index]!;
    shuffled[index] = shuffled[swapIndex]!;
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

/**
 * Builds a random speaking order: each player gets exactly one turn to ask.
 */
export function buildSpeakingOrder(playerIds: string[]): string[] {
  if (playerIds.length === 0) {
    return [];
  }

  return shufflePlayerIds(playerIds);
}

/**
 * Builds circular directed-question pairs from a shuffled order.
 * Each player asks exactly once and is targeted exactly once.
 */
export function buildDirectedQuestionPairsFromOrder(
  order: string[],
): BaraAlSalafaDirectedQuestionPair[] {
  const playerCount = order.length;

  if (playerCount < 2) {
    throw new DirectedQuestionPairsBuildError(
      `Directed question pairs require at least 2 players, received ${playerCount}.`,
    );
  }

  const uniquePlayerIds = new Set(order);

  if (uniquePlayerIds.size !== playerCount) {
    throw new DirectedQuestionPairsBuildError(
      'Directed question pairs require a unique player order without duplicates.',
    );
  }

  const pairs = order.map((askerPlayerId, index) => {
    const targetPlayerId = order[(index + 1) % playerCount]!;

    if (askerPlayerId === targetPlayerId) {
      throw new DirectedQuestionPairsBuildError(
        `Directed question pair would assign the same asker and target: ${askerPlayerId}.`,
      );
    }

    return {
      askerPlayerId,
      targetPlayerId,
    };
  });

  return pairs;
}
