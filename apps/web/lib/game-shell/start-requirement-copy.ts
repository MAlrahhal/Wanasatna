export type GameStartPlayerRequirementParts = {
  before: string;
  gameName: string;
  after: string;
};

const GAME_START_PLAYER_REQUIREMENT_PATTERN =
  /^(تحتاج لعبة )(.+)( إلى \d+ لاعبين على الأقل\.)$/;

/** Splits the min-player sentence so the dynamic game name can be emphasized. */
export function splitGameStartPlayerRequirementReason(
  reason: string,
): GameStartPlayerRequirementParts | null {
  const match = GAME_START_PLAYER_REQUIREMENT_PATTERN.exec(reason);

  if (!match) {
    return null;
  }

  return {
    before: match[1]!,
    gameName: match[2]!,
    after: match[3]!,
  };
}
