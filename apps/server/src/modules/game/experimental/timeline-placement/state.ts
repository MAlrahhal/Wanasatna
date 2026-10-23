import { randomUUID } from 'node:crypto';
import type {
  GameShellState,
  TimelineGap,
  TimelineLeaderboardEntry,
  TimelinePlacementPlayerView,
  TimelinePlacementRevealEntry,
  TimelinePlacementSettings,
  TimelinePublicEvent,
} from '@wanasatna/shared';
import {
  TIMELINE_PLACEMENT_ANSWER_REVEAL_MS,
  TIMELINE_PLACEMENT_GAME_ID,
  TIMELINE_PLACEMENT_PLACEMENTS_REVEAL_MS,
  TIMELINE_PLACEMENT_RESULTS_MS,
} from '@wanasatna/shared';
import {
  TIMELINE_PLACEMENT_EVENTS,
  type TimelinePlacementContentEntry,
} from './provisional-content.js';

export type TimelinePlacementResultReason =
  'round-complete' | 'match-complete' | 'insufficient-players';

type StoredPlacement = {
  playerId: string;
  gapId: string;
  isCorrect: boolean;
  roundPoints: number;
};

export type TimelinePlacementRoundState = {
  roundId: string;
  phase: 'selecting' | 'placements-reveal' | 'answer-reveal' | 'completed';
  candidate: TimelinePlacementContentEntry;
  gaps: TimelineGap[];
  correctGapId: string;
  eligiblePlayerIds: string[];
  choicesByPlayerId: Record<string, string>;
  placements: StoredPlacement[];
  deadlineAtMs: number | null;
  scored: boolean;
  resultReason: TimelinePlacementResultReason | null;
};

export type TimelinePlacementMatchState = {
  matchId: string;
  playerIds: string[];
  playerOrder: string[];
  playerNames: Record<string, string>;
  departedPlayerIds: string[];
  settings: TimelinePlacementSettings;
  currentRound: number;
  scores: Record<string, number>;
  timeline: TimelinePlacementContentEntry[];
  queuedEvents: TimelinePlacementContentEntry[];
  usedEventIds: string[];
  round: TimelinePlacementRoundState;
};

type ActionResult =
  | { ok: true; match: TimelinePlacementMatchState; changed: boolean }
  | { ok: false; message: string };

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const other = Math.min(index, Math.floor(random() * (index + 1)));
    [next[index], next[other]] = [next[other]!, next[index]!];
  }
  return next;
}

export function buildTimelineGaps(
  timeline: readonly Pick<TimelinePlacementContentEntry, 'id'>[],
): TimelineGap[] {
  if (timeline.length === 0) return [];
  const gaps: TimelineGap[] = [
    { id: `before:${timeline[0]!.id}`, beforeEventId: null, afterEventId: timeline[0]!.id },
  ];
  for (let index = 0; index < timeline.length - 1; index += 1) {
    const before = timeline[index]!;
    const after = timeline[index + 1]!;
    gaps.push({
      id: `between:${before.id}:${after.id}`,
      beforeEventId: before.id,
      afterEventId: after.id,
    });
  }
  gaps.push({
    id: `after:${timeline.at(-1)!.id}`,
    beforeEventId: timeline.at(-1)!.id,
    afterEventId: null,
  });
  return gaps;
}

export function resolveTimelineCorrectGapId(
  timeline: readonly TimelinePlacementContentEntry[],
  candidate: TimelinePlacementContentEntry,
): string {
  const insertionIndex = timeline.findIndex((entry) => entry.year > candidate.year);
  if (insertionIndex === 0) return `before:${timeline[0]!.id}`;
  if (insertionIndex === -1) return `after:${timeline.at(-1)!.id}`;
  return `between:${timeline[insertionIndex - 1]!.id}:${timeline[insertionIndex]!.id}`;
}

function createRound(input: {
  candidate: TimelinePlacementContentEntry;
  timeline: readonly TimelinePlacementContentEntry[];
  eligiblePlayerIds: readonly string[];
  selectionSeconds: number;
  now: number;
}): TimelinePlacementRoundState {
  return {
    roundId: randomUUID(),
    phase: 'selecting',
    candidate: input.candidate,
    gaps: buildTimelineGaps(input.timeline),
    correctGapId: resolveTimelineCorrectGapId(input.timeline, input.candidate),
    eligiblePlayerIds: [...input.eligiblePlayerIds],
    choicesByPlayerId: {},
    placements: [],
    deadlineAtMs: input.now + input.selectionSeconds * 1000,
    scored: false,
    resultReason: null,
  };
}

export function createTimelinePlacementMatch(input: {
  playerIds: readonly string[];
  playerNames: Record<string, string>;
  settings: TimelinePlacementSettings;
  random?: () => number;
  now?: number;
  content?: readonly TimelinePlacementContentEntry[];
}): TimelinePlacementMatchState {
  const random = input.random ?? Math.random;
  const now = input.now ?? Date.now();
  const playerIds = [...new Set(input.playerIds)];
  const required = input.settings.roundCount + 2;
  const content = input.content ?? TIMELINE_PLACEMENT_EVENTS;
  if (
    content.length < required ||
    new Set(content.map((entry) => entry.year)).size !== content.length
  ) {
    throw new Error('Timeline Placement needs enough events with unique years.');
  }
  const selected = shuffle(content, random).slice(0, required);
  const timeline = selected.slice(0, 2).sort((left, right) => left.year - right.year);
  const queuedEvents = selected.slice(2);
  const candidate = queuedEvents[0]!;
  return {
    matchId: randomUUID(),
    playerIds,
    playerOrder: [...playerIds],
    playerNames: { ...input.playerNames },
    departedPlayerIds: [],
    settings: { ...input.settings },
    currentRound: 1,
    scores: Object.fromEntries(playerIds.map((playerId) => [playerId, 0])),
    timeline,
    queuedEvents,
    usedEventIds: selected.map((entry) => entry.id),
    round: createRound({
      candidate,
      timeline,
      eligiblePlayerIds: playerIds,
      selectionSeconds: input.settings.selectionSeconds,
      now,
    }),
  };
}

export function chooseTimelineGap(
  match: TimelinePlacementMatchState,
  playerId: string,
  payload: { roundId: string; gapId: string },
  now = Date.now(),
): ActionResult {
  if (
    match.round.phase !== 'selecting' ||
    match.round.roundId !== payload.roundId ||
    match.round.deadlineAtMs === null ||
    now >= match.round.deadlineAtMs
  ) {
    return { ok: false, message: 'انتهى وقت اختيار موقع الحدث.' };
  }
  if (!match.round.eligiblePlayerIds.includes(playerId) || !match.playerIds.includes(playerId)) {
    return { ok: false, message: 'المشاهدون لا يملكون اختيارًا في هذه الجولة.' };
  }
  if (!match.round.gaps.some((gap) => gap.id === payload.gapId)) {
    return { ok: false, message: 'الموقع المختار غير صالح لهذا الخط الزمني.' };
  }
  if (match.round.choicesByPlayerId[playerId] === payload.gapId) {
    return { ok: true, changed: false, match };
  }
  return {
    ok: true,
    changed: true,
    match: {
      ...match,
      round: {
        ...match.round,
        choicesByPlayerId: { ...match.round.choicesByPlayerId, [playerId]: payload.gapId },
      },
    },
  };
}

function revealPlacements(
  match: TimelinePlacementMatchState,
  now: number,
): TimelinePlacementMatchState {
  if (match.round.scored) return match;
  const scores = { ...match.scores };
  const placements = match.round.eligiblePlayerIds.flatMap((playerId) => {
    const gapId = match.round.choicesByPlayerId[playerId];
    if (!gapId) return [];
    const isCorrect = gapId === match.round.correctGapId;
    const roundPoints = isCorrect ? 100 : 0;
    scores[playerId] = (scores[playerId] ?? 0) + roundPoints;
    return [{ playerId, gapId, isCorrect, roundPoints }];
  });
  return {
    ...match,
    scores,
    round: {
      ...match.round,
      phase: 'placements-reveal',
      placements,
      deadlineAtMs: now + TIMELINE_PLACEMENT_PLACEMENTS_REVEAL_MS,
      scored: true,
      resultReason: 'round-complete',
    },
  };
}

function revealAnswer(
  match: TimelinePlacementMatchState,
  now: number,
): TimelinePlacementMatchState {
  const timeline = [...match.timeline, match.round.candidate].sort(
    (left, right) => left.year - right.year,
  );
  return {
    ...match,
    timeline,
    round: {
      ...match.round,
      phase: 'answer-reveal',
      deadlineAtMs: now + TIMELINE_PLACEMENT_ANSWER_REVEAL_MS,
    },
  };
}

function completeMatch(
  match: TimelinePlacementMatchState,
  now: number,
  reason: 'match-complete' | 'insufficient-players',
): TimelinePlacementMatchState {
  return {
    ...match,
    round: {
      ...match.round,
      phase: 'completed',
      deadlineAtMs: now + TIMELINE_PLACEMENT_RESULTS_MS,
      resultReason: reason,
    },
  };
}

function advanceAfterAnswer(
  match: TimelinePlacementMatchState,
  now: number,
): TimelinePlacementMatchState {
  if (match.currentRound >= match.settings.roundCount) {
    return completeMatch(match, now, 'match-complete');
  }
  const currentRound = match.currentRound + 1;
  const candidate = match.queuedEvents[currentRound - 1]!;
  return {
    ...match,
    currentRound,
    round: createRound({
      candidate,
      timeline: match.timeline,
      eligiblePlayerIds: match.playerIds,
      selectionSeconds: match.settings.selectionSeconds,
      now,
    }),
  };
}

export function expireTimelinePlacementPhase(
  match: TimelinePlacementMatchState,
  expectedRoundId: string,
  expectedPhase: TimelinePlacementRoundState['phase'],
  now = Date.now(),
): TimelinePlacementMatchState | null {
  if (
    match.round.roundId !== expectedRoundId ||
    match.round.phase !== expectedPhase ||
    match.round.deadlineAtMs === null ||
    now < match.round.deadlineAtMs
  ) {
    return null;
  }
  if (expectedPhase === 'selecting') return revealPlacements(match, now);
  if (expectedPhase === 'placements-reveal') return revealAnswer(match, now);
  if (expectedPhase === 'answer-reveal') return advanceAfterAnswer(match, now);
  return match;
}

export function advanceTimelinePlacementAnswer(
  match: TimelinePlacementMatchState,
  playerId: string,
  hostPlayerId: string,
  payload: { roundId: string },
  now = Date.now(),
): ActionResult {
  if (playerId !== hostPlayerId) {
    return { ok: false, message: 'المضيف الحالي فقط يستطيع الانتقال للجولة التالية.' };
  }
  if (match.round.phase !== 'answer-reveal' || match.round.roundId !== payload.roundId) {
    return { ok: false, message: 'لا يمكن الانتقال في هذه المرحلة.' };
  }
  return { ok: true, changed: true, match: advanceAfterAnswer(match, now) };
}

export function handleTimelinePlacementPermanentLeave(
  match: TimelinePlacementMatchState,
  playerId: string,
  now = Date.now(),
): TimelinePlacementMatchState {
  if (!match.playerIds.includes(playerId) || match.departedPlayerIds.includes(playerId))
    return match;
  const next = {
    ...match,
    playerIds: match.playerIds.filter((id) => id !== playerId),
    departedPlayerIds: [...match.departedPlayerIds, playerId],
  };
  if (next.round.phase === 'completed' || next.playerIds.length >= 2) return next;
  return completeMatch(next, now, 'insufficient-players');
}

function buildLeaderboard(match: TimelinePlacementMatchState): TimelineLeaderboardEntry[] {
  const order = new Map(match.playerOrder.map((playerId, index) => [playerId, index]));
  return match.playerOrder
    .map((playerId) => ({
      playerId,
      name: match.playerNames[playerId] ?? 'لاعب',
      score: match.scores[playerId] ?? 0,
      isDeparted: match.departedPlayerIds.includes(playerId),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        (order.get(left.playerId) ?? 0) - (order.get(right.playerId) ?? 0),
    );
}

function publicTimeline(timeline: readonly TimelinePlacementContentEntry[]): TimelinePublicEvent[] {
  return timeline.map(({ id, text, year }) => ({ id, text, year }));
}

function publicPlacements(
  match: TimelinePlacementMatchState,
  revealCorrectness: boolean,
): TimelinePlacementRevealEntry[] {
  return match.round.placements.map((placement) => ({
    playerId: placement.playerId,
    name: match.playerNames[placement.playerId] ?? 'لاعب',
    gapId: placement.gapId,
    isCorrect: revealCorrectness ? placement.isCorrect : null,
    roundPoints: revealCorrectness ? placement.roundPoints : null,
  }));
}

export function buildTimelinePlacementPlayerView(
  match: TimelinePlacementMatchState,
  playerId: string,
  shell: GameShellState,
  now = Date.now(),
): TimelinePlacementPlayerView {
  const isParticipant =
    match.playerIds.includes(playerId) && !match.departedPlayerIds.includes(playerId);
  const answerVisible = match.round.phase === 'answer-reveal' || match.round.phase === 'completed';
  const placementsVisible = answerVisible || match.round.phase === 'placements-reveal';
  const leaderboard = buildLeaderboard(match);
  const bestScore = leaderboard[0]?.score ?? 0;
  return {
    gameId: TIMELINE_PLACEMENT_GAME_ID,
    selfPlayerId: playerId,
    settings: { ...match.settings },
    phase: match.round.phase,
    currentRound: match.currentRound,
    totalRounds: match.settings.roundCount,
    roundId: match.round.roundId,
    timeline: publicTimeline(match.timeline),
    candidate:
      match.round.phase === 'completed'
        ? null
        : { id: match.round.candidate.id, text: match.round.candidate.text },
    availableGaps: match.round.gaps.map((gap) => ({ ...gap })),
    ownGapId: match.round.choicesByPlayerId[playerId] ?? null,
    submittedChoiceCount: Object.keys(match.round.choicesByPlayerId).length,
    eligiblePlayerCount: match.round.eligiblePlayerIds.length,
    deadlineAtMs: match.round.deadlineAtMs,
    remainingSeconds:
      match.round.deadlineAtMs === null
        ? null
        : Math.max(0, Math.ceil((match.round.deadlineAtMs - now) / 1000)),
    placements: placementsVisible ? publicPlacements(match, answerVisible) : [],
    revealedAnswer: answerVisible
      ? {
          event: {
            id: match.round.candidate.id,
            text: match.round.candidate.text,
            year: match.round.candidate.year,
          },
          correctGapId: match.round.correctGapId,
        }
      : null,
    leaderboard,
    winnerPlayerIds:
      match.round.phase === 'completed'
        ? leaderboard.filter((entry) => entry.score === bestScore).map((entry) => entry.playerId)
        : [],
    isSpectator: !isParticipant,
    isHost: shell.hostPlayerId === playerId,
    canChoose: isParticipant && match.round.phase === 'selecting',
    canAdvance: shell.hostPlayerId === playerId && match.round.phase === 'answer-reveal',
    resultReason: placementsVisible ? match.round.resultReason : null,
  };
}
