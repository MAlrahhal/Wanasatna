import type { GameSoundId } from '@/lib/game/sounds';

export type SfxCue = {
  id: GameSoundId;
  eventKey: string;
};

export type CountdownCursor = null | 'idle' | 1 | 2 | 3;

export function countdownDisplay(seconds: number | null): 1 | 2 | 3 | null {
  if (seconds == null || seconds <= 0) {
    return null;
  }
  if (seconds >= 3) {
    return 3;
  }
  if (seconds <= 1) {
    return 1;
  }
  return 2;
}

export function decideCountdownTick(
  prev: CountdownCursor,
  inCountdown: boolean,
  seconds: number | null,
): { next: CountdownCursor; play: 1 | 2 | 3 | null } {
  if (!inCountdown) {
    return { next: 'idle', play: null };
  }
  const value = countdownDisplay(seconds);
  if (value == null) {
    return { next: 'idle', play: null };
  }
  if (prev === null) {
    return { next: value, play: null };
  }
  if (prev === 'idle' || prev !== value) {
    return { next: value, play: value };
  }
  return { next: value, play: null };
}

export function uniqueFirstPlaceId(
  entries: Array<{ playerId: string; isFirstPlace?: boolean; rank?: number }>,
): string | null {
  const firsts = entries.filter((entry) => entry.isFirstPlace === true || entry.rank === 1);
  if (firsts.length !== 1) {
    return null;
  }
  return firsts[0]?.playerId ?? null;
}

export function localWonMatch(
  entries: Array<{ playerId: string; isFirstPlace?: boolean; rank?: number }>,
  selfId: string,
): boolean {
  return uniqueFirstPlaceId(entries) === selfId;
}

/** Team win: every first-place entry belongs to the local team, and not everyone tied. */
export function localTeamWonMatch(
  entries: Array<{ playerId: string; isFirstPlace?: boolean; rank?: number }>,
  teamPlayerIds: string[],
): boolean {
  const team = new Set(teamPlayerIds.filter(Boolean));
  if (team.size === 0) {
    return false;
  }
  const firsts = entries.filter((entry) => entry.isFirstPlace === true || entry.rank === 1);
  if (firsts.length === 0 || firsts.length === entries.length) {
    return false;
  }
  return firsts.every((entry) => team.has(entry.playerId));
}

export function decideYourTurn(args: {
  prevReady: boolean;
  prevTurnKey: string | null;
  acting: boolean;
  turnKey: string | null;
  spectator: boolean;
}): SfxCue | null {
  if (args.spectator || !args.acting || !args.turnKey) {
    return null;
  }
  if (!args.prevReady) {
    return null;
  }
  if (args.prevTurnKey === args.turnKey) {
    return null;
  }
  return { id: 'your-turn', eventKey: `turn:${args.turnKey}` };
}

export function decideTimeUp(args: {
  prevReady: boolean;
  prevRemaining: number;
  remaining: number;
  phase: string;
  timedPhases: ReadonlySet<string>;
  eventKey: string;
  suppress?: boolean;
}): SfxCue | null {
  if (args.suppress || !args.prevReady || !args.timedPhases.has(args.phase)) {
    return null;
  }
  if (args.prevRemaining > 0 && args.remaining === 0) {
    return { id: 'time-up', eventKey: args.eventKey };
  }
  return null;
}

export function decideRoundResult(args: {
  prevReady: boolean;
  prevPhase: string;
  phase: string;
  eventKey: string;
}): SfxCue | null {
  if (!args.prevReady || args.phase !== 'round-results' || args.prevPhase === 'round-results') {
    return null;
  }
  return { id: 'round-result', eventKey: args.eventKey };
}

export function decideFinalCue(args: {
  prevReady: boolean;
  prevPhase: string;
  phase: string;
  spectator: boolean;
  localWon: boolean;
  eventKey: string;
}): SfxCue | null {
  if (!args.prevReady || args.phase !== 'match-completed' || args.prevPhase === 'match-completed') {
    return null;
  }
  if (!args.spectator && args.localWon) {
    return { id: 'match-win', eventKey: `${args.eventKey}:win` };
  }
  if (args.prevPhase === 'round-results') {
    return null;
  }
  return { id: 'round-result', eventKey: `${args.eventKey}:end` };
}

export function decidePublicCorrect(args: {
  prevReady: boolean;
  wasCorrect: boolean;
  isCorrect: boolean;
  eventKey: string;
}): SfxCue | null {
  if (!args.prevReady || args.wasCorrect || !args.isCorrect) {
    return null;
  }
  return { id: 'correct', eventKey: args.eventKey };
}
