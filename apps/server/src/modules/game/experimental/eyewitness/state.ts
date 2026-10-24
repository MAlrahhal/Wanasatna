import { randomUUID } from 'node:crypto';
import type {
  DrawStroke,
  EyewitnessPlayerView,
  EyewitnessSettings,
  GameShellState,
} from '@wanasatna/shared';
import { EYEWITNESS_GAME_ID } from '@wanasatna/shared';
import { EYEWITNESS_IMAGE_BANK, getEyewitnessImageDataUrl } from './image-bank.js';

export const EYEWITNESS_ROUND_RESULTS_MS = 10_000;
export const EYEWITNESS_COMPLETED_MS = 15_000;
export const EYEWITNESS_MAX_DESCRIPTION_LENGTH = 600;

export type EyewitnessArtworkState = {
  artworkId: string;
  artistPlayerId: string;
  strokes: DrawStroke[];
  submitted: boolean;
};

export type EyewitnessRoundState = {
  roundId: string;
  phase: 'witness' | 'drawing' | 'voting' | 'round-results' | 'completed';
  imageId: string;
  witnessPlayerId: string;
  artistPlayerIds: string[];
  descriptionDraft: string;
  lockedDescription: string | null;
  artworksByPlayerId: Record<string, EyewitnessArtworkState>;
  artworkOrder: string[];
  votesByPlayerId: Record<string, string>;
  roundWinnerArtworkIds: string[];
  deadlineAtMs: number | null;
  pausedWitnessRemainingMs: number | null;
  resultReason: 'voting-complete' | 'witness-left' | 'insufficient-players' | null;
};

export type EyewitnessMatchState = {
  matchId: string;
  playerIds: string[];
  playerNames: Record<string, string>;
  scores: Record<string, number>;
  departedPlayerIds: string[];
  settings: EyewitnessSettings;
  currentRound: number;
  usedImageIds: string[];
  witnessQueue: string[];
  witnessedThisCycle: string[];
  processedRequestIds: string[];
  round: EyewitnessRoundState;
};

export type EyewitnessActionResult =
  { ok: true; changed: boolean; match: EyewitnessMatchState } | { ok: false; message: string };

function cloneStrokes(strokes: readonly DrawStroke[]): DrawStroke[] {
  return strokes.map((stroke) => ({ ...stroke, points: [...stroke.points] }));
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
  }
  return next;
}

function chooseWitness(input: {
  activePlayerIds: readonly string[];
  queue: readonly string[];
  witnessedThisCycle: readonly string[];
  random: () => number;
}) {
  const active = new Set(input.activePlayerIds);
  let queue = input.queue.filter((id) => active.has(id));
  let witnessedThisCycle = input.witnessedThisCycle.filter((id) => active.has(id));
  if (queue.length === 0) {
    queue = shuffle(input.activePlayerIds, input.random);
    witnessedThisCycle = [];
  }
  const playerId = queue[0]!;
  return {
    playerId,
    queue: queue.slice(1),
    witnessedThisCycle: [...witnessedThisCycle, playerId],
  };
}

function chooseImage(usedIds: readonly string[], random: () => number) {
  const remaining = EYEWITNESS_IMAGE_BANK.filter((entry) => !usedIds.includes(entry.id));
  if (remaining.length === 0) throw new Error('Eyewitness image bank exhausted.');
  const image = remaining[Math.min(remaining.length - 1, Math.floor(random() * remaining.length))]!;
  return { imageId: image.id, usedImageIds: [...usedIds, image.id] };
}

function createRound(input: {
  activePlayerIds: readonly string[];
  queue: readonly string[];
  witnessedThisCycle: readonly string[];
  usedImageIds: readonly string[];
  settings: EyewitnessSettings;
  random: () => number;
  now: number;
}) {
  const witness = chooseWitness(input);
  const image = chooseImage(input.usedImageIds, input.random);
  const artistPlayerIds = input.activePlayerIds.filter((id) => id !== witness.playerId);
  const artworksByPlayerId = Object.fromEntries(
    artistPlayerIds.map((artistPlayerId) => [
      artistPlayerId,
      { artworkId: randomUUID(), artistPlayerId, strokes: [], submitted: false },
    ]),
  );
  return {
    witnessQueue: witness.queue,
    witnessedThisCycle: witness.witnessedThisCycle,
    usedImageIds: image.usedImageIds,
    round: {
      roundId: randomUUID(),
      phase: 'witness' as const,
      imageId: image.imageId,
      witnessPlayerId: witness.playerId,
      artistPlayerIds,
      descriptionDraft: '',
      lockedDescription: null,
      artworksByPlayerId,
      artworkOrder: shuffle(
        Object.values(artworksByPlayerId).map((artwork) => artwork.artworkId),
        input.random,
      ),
      votesByPlayerId: {},
      roundWinnerArtworkIds: [],
      deadlineAtMs: input.now + input.settings.descriptionSeconds * 1000,
      pausedWitnessRemainingMs: null,
      resultReason: null,
    } satisfies EyewitnessRoundState,
  };
}

export function createEyewitnessMatch(input: {
  playerIds: readonly string[];
  playerNames: Record<string, string>;
  settings: EyewitnessSettings;
  random?: () => number;
  now?: number;
}): EyewitnessMatchState {
  const playerIds = [...new Set(input.playerIds)];
  if (input.settings.roundCount > EYEWITNESS_IMAGE_BANK.length) {
    throw new Error('Eyewitness round count exceeds the image bank.');
  }
  const first = createRound({
    activePlayerIds: playerIds,
    queue: [],
    witnessedThisCycle: [],
    usedImageIds: [],
    settings: input.settings,
    random: input.random ?? Math.random,
    now: input.now ?? Date.now(),
  });
  return {
    matchId: randomUUID(),
    playerIds,
    playerNames: { ...input.playerNames },
    scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
    departedPlayerIds: [],
    settings: { ...input.settings },
    currentRound: 1,
    usedImageIds: first.usedImageIds,
    witnessQueue: first.witnessQueue,
    witnessedThisCycle: first.witnessedThisCycle,
    processedRequestIds: [],
    round: first.round,
  };
}

function activePlayerIds(match: EyewitnessMatchState): string[] {
  const departed = new Set(match.departedPlayerIds);
  return match.playerIds.filter((id) => !departed.has(id));
}

function validDescription(value: unknown): value is string {
  return typeof value === 'string' && value.length <= EYEWITNESS_MAX_DESCRIPTION_LENGTH;
}

export function updateEyewitnessDescription(
  match: EyewitnessMatchState,
  playerId: string,
  payload: { roundId: string; description: unknown },
  now = Date.now(),
): EyewitnessActionResult {
  if (
    match.round.phase !== 'witness' ||
    match.round.roundId !== payload.roundId ||
    match.round.deadlineAtMs === null ||
    now >= match.round.deadlineAtMs
  )
    return { ok: false, message: 'انتهت مرحلة وصف الصورة.' };
  if (match.round.witnessPlayerId !== playerId || match.departedPlayerIds.includes(playerId))
    return { ok: false, message: 'شاهد العيان فقط يمكنه كتابة الوصف.' };
  if (!validDescription(payload.description))
    return { ok: false, message: 'الوصف طويل جدًا أو غير صالح.' };
  return {
    ok: true,
    changed: payload.description !== match.round.descriptionDraft,
    match: {
      ...match,
      round: { ...match.round, descriptionDraft: payload.description },
    },
  };
}

export function beginEyewitnessDrawing(
  match: EyewitnessMatchState,
  now = Date.now(),
): EyewitnessMatchState {
  if (match.round.phase !== 'witness') return match;
  return {
    ...match,
    round: {
      ...match.round,
      phase: 'drawing',
      lockedDescription: match.round.descriptionDraft,
      deadlineAtMs: now + match.settings.drawingSeconds * 1000,
      pausedWitnessRemainingMs: null,
    },
  };
}

export function submitEyewitnessDescription(
  match: EyewitnessMatchState,
  playerId: string,
  payload: { roundId: string; description: unknown },
  now = Date.now(),
): EyewitnessActionResult {
  const updated = updateEyewitnessDescription(match, playerId, payload, now);
  if (!updated.ok) return updated;
  return { ok: true, changed: true, match: beginEyewitnessDrawing(updated.match, now) };
}

export function updateEyewitnessArtworkStrokes(
  match: EyewitnessMatchState,
  playerId: string,
  strokes: DrawStroke[],
): EyewitnessMatchState {
  const artwork = match.round.artworksByPlayerId[playerId];
  if (!artwork) return match;
  return {
    ...match,
    round: {
      ...match.round,
      artworksByPlayerId: {
        ...match.round.artworksByPlayerId,
        [playerId]: { ...artwork, strokes: cloneStrokes(strokes) },
      },
    },
  };
}

export function beginEyewitnessVoting(
  match: EyewitnessMatchState,
  now = Date.now(),
): EyewitnessMatchState {
  if (match.round.phase !== 'drawing') return match;
  return {
    ...match,
    round: {
      ...match.round,
      phase: 'voting',
      deadlineAtMs: now + match.settings.votingSeconds * 1000,
    },
  };
}

export function submitEyewitnessArtwork(
  match: EyewitnessMatchState,
  playerId: string,
  roundId: string,
  now = Date.now(),
): EyewitnessActionResult {
  const artwork = match.round.artworksByPlayerId[playerId];
  if (
    match.round.phase !== 'drawing' ||
    match.round.roundId !== roundId ||
    (match.round.deadlineAtMs !== null && now >= match.round.deadlineAtMs)
  )
    return { ok: false, message: 'انتهت مرحلة الرسم.' };
  if (!artwork || match.departedPlayerIds.includes(playerId))
    return { ok: false, message: 'لا يمكنك تسليم رسمة في هذه الجولة.' };
  if (artwork.submitted) return { ok: false, message: 'تم تثبيت رسمتك مسبقًا.' };
  const artworksByPlayerId = {
    ...match.round.artworksByPlayerId,
    [playerId]: { ...artwork, submitted: true },
  };
  let next = { ...match, round: { ...match.round, artworksByPlayerId } };
  const departed = new Set(match.departedPlayerIds);
  const allDone = match.round.artistPlayerIds
    .filter((id) => !departed.has(id))
    .every((id) => artworksByPlayerId[id]?.submitted);
  if (allDone) next = beginEyewitnessVoting(next, now);
  return { ok: true, changed: true, match: next };
}

export function confirmEyewitnessVote(
  match: EyewitnessMatchState,
  playerId: string,
  payload: { roundId: string; artworkId: string },
  now = Date.now(),
): EyewitnessActionResult {
  if (
    match.round.phase !== 'voting' ||
    payload.roundId !== match.round.roundId ||
    match.round.deadlineAtMs === null ||
    now >= match.round.deadlineAtMs
  )
    return { ok: false, message: 'انتهى التصويت لهذه الجولة.' };
  if (!match.playerIds.includes(playerId) || match.departedPlayerIds.includes(playerId))
    return { ok: false, message: 'المشاركون في الجولة فقط يمكنهم التصويت.' };
  const target = Object.values(match.round.artworksByPlayerId).find(
    (artwork) => artwork.artworkId === payload.artworkId,
  );
  if (!target) return { ok: false, message: 'الرسمة المحددة غير صالحة.' };
  if (target.artistPlayerId === playerId) return { ok: false, message: 'لا يمكنك التصويت لرسمتك.' };
  const previous = match.round.votesByPlayerId[playerId];
  return {
    ok: true,
    changed: previous !== payload.artworkId,
    match: {
      ...match,
      round: {
        ...match.round,
        votesByPlayerId: { ...match.round.votesByPlayerId, [playerId]: payload.artworkId },
      },
    },
  };
}

export function revealEyewitnessRound(
  match: EyewitnessMatchState,
  reason: EyewitnessRoundState['resultReason'] = 'voting-complete',
  now = Date.now(),
): EyewitnessMatchState {
  if (match.round.phase === 'round-results' || match.round.phase === 'completed') return match;
  const counts = new Map<string, number>();
  for (const artworkId of Object.values(match.round.votesByPlayerId)) {
    counts.set(artworkId, (counts.get(artworkId) ?? 0) + 1);
  }
  const highest = Math.max(0, ...counts.values());
  const roundWinnerArtworkIds =
    highest > 0 ? match.round.artworkOrder.filter((id) => (counts.get(id) ?? 0) === highest) : [];
  const scores = { ...match.scores };
  for (const artwork of Object.values(match.round.artworksByPlayerId)) {
    if (roundWinnerArtworkIds.includes(artwork.artworkId)) {
      scores[artwork.artistPlayerId] = (scores[artwork.artistPlayerId] ?? 0) + 1;
    }
  }
  return {
    ...match,
    scores,
    round: {
      ...match.round,
      phase: 'round-results',
      roundWinnerArtworkIds,
      deadlineAtMs: now + EYEWITNESS_ROUND_RESULTS_MS,
      pausedWitnessRemainingMs: null,
      resultReason: reason,
    },
  };
}

function completeEyewitnessMatch(match: EyewitnessMatchState, now: number): EyewitnessMatchState {
  return {
    ...match,
    round: {
      ...match.round,
      phase: 'completed',
      deadlineAtMs: now + EYEWITNESS_COMPLETED_MS,
      pausedWitnessRemainingMs: null,
    },
  };
}

export function advanceEyewitnessRound(
  match: EyewitnessMatchState,
  participants: readonly { playerId: string; name: string }[],
  requestId: string | null,
  now = Date.now(),
  random: () => number = Math.random,
  newlyEligiblePlayerIds: readonly string[] = [],
): EyewitnessActionResult {
  if (match.round.phase !== 'round-results')
    return { ok: false, message: 'لا يمكن الانتقال في هذه المرحلة.' };
  if (requestId && match.processedRequestIds.includes(requestId))
    return { ok: true, changed: false, match };

  const playerIds = [...match.playerIds];
  const playerNames = { ...match.playerNames };
  const scores = { ...match.scores };
  const witnessQueue = [...match.witnessQueue];
  const departed = new Set(match.departedPlayerIds);
  const newlyEligible = new Set(newlyEligiblePlayerIds);
  for (const participant of participants) {
    if (departed.has(participant.playerId)) continue;
    playerNames[participant.playerId] = participant.name;
    if (!playerIds.includes(participant.playerId)) {
      playerIds.push(participant.playerId);
      scores[participant.playerId] = 0;
      newlyEligible.add(participant.playerId);
    }
    if (
      newlyEligible.has(participant.playerId) &&
      !match.witnessedThisCycle.includes(participant.playerId) &&
      !witnessQueue.includes(participant.playerId)
    ) {
      witnessQueue.push(participant.playerId);
    }
  }
  const expanded = { ...match, playerIds, playerNames, scores, witnessQueue };
  const active = activePlayerIds(expanded);
  const processedRequestIds = requestId
    ? [...match.processedRequestIds, requestId].slice(-100)
    : match.processedRequestIds;
  if (active.length < 3 || match.currentRound >= match.settings.roundCount) {
    return {
      ok: true,
      changed: true,
      match: completeEyewitnessMatch({ ...expanded, processedRequestIds }, now),
    };
  }
  const next = createRound({
    activePlayerIds: active,
    queue: witnessQueue,
    witnessedThisCycle: match.witnessedThisCycle,
    usedImageIds: match.usedImageIds,
    settings: match.settings,
    random,
    now,
  });
  return {
    ok: true,
    changed: true,
    match: {
      ...expanded,
      processedRequestIds,
      currentRound: match.currentRound + 1,
      usedImageIds: next.usedImageIds,
      witnessQueue: next.witnessQueue,
      witnessedThisCycle: next.witnessedThisCycle,
      round: next.round,
    },
  };
}

export function expireEyewitnessPhase(
  match: EyewitnessMatchState,
  expectedRoundId: string,
  expectedPhase: EyewitnessRoundState['phase'],
  now = Date.now(),
): EyewitnessMatchState | null {
  if (
    match.round.roundId !== expectedRoundId ||
    match.round.phase !== expectedPhase ||
    match.round.deadlineAtMs === null ||
    now < match.round.deadlineAtMs
  )
    return null;
  if (expectedPhase === 'witness') return beginEyewitnessDrawing(match, now);
  if (expectedPhase === 'drawing') return beginEyewitnessVoting(match, now);
  if (expectedPhase === 'voting') {
    return revealEyewitnessRound(
      match,
      activePlayerIds(match).length < 3 ? 'insufficient-players' : 'voting-complete',
      now,
    );
  }
  return null;
}

export function reconcileEyewitnessWitnessConnection(
  match: EyewitnessMatchState,
  connected: boolean,
  now = Date.now(),
): EyewitnessMatchState {
  if (match.round.phase !== 'witness') return match;
  if (!connected && match.round.deadlineAtMs !== null) {
    return {
      ...match,
      round: {
        ...match.round,
        pausedWitnessRemainingMs: Math.max(0, match.round.deadlineAtMs - now),
        deadlineAtMs: null,
      },
    };
  }
  if (
    connected &&
    match.round.deadlineAtMs === null &&
    match.round.pausedWitnessRemainingMs !== null
  ) {
    return {
      ...match,
      round: {
        ...match.round,
        deadlineAtMs: now + match.round.pausedWitnessRemainingMs,
        pausedWitnessRemainingMs: null,
      },
    };
  }
  return match;
}

export function handleEyewitnessPermanentLeave(
  match: EyewitnessMatchState,
  playerId: string,
  now = Date.now(),
): EyewitnessMatchState {
  if (!match.playerIds.includes(playerId) || match.departedPlayerIds.includes(playerId))
    return match;
  const next = { ...match, departedPlayerIds: [...match.departedPlayerIds, playerId] };
  if (match.round.phase === 'witness' && match.round.witnessPlayerId === playerId) {
    return revealEyewitnessRound(
      {
        ...next,
        round: { ...next.round, artworksByPlayerId: {}, artworkOrder: [] },
      },
      'witness-left',
      now,
    );
  }
  return next;
}

function resultCounts(match: EyewitnessMatchState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const artworkId of Object.values(match.round.votesByPlayerId)) {
    counts.set(artworkId, (counts.get(artworkId) ?? 0) + 1);
  }
  return counts;
}

export function buildEyewitnessPlayerView(
  match: EyewitnessMatchState,
  playerId: string,
  shell: GameShellState,
  now = Date.now(),
): EyewitnessPlayerView {
  const departed = match.departedPlayerIds.includes(playerId);
  const isParticipant = match.playerIds.includes(playerId) && !departed;
  const isWitness = match.round.witnessPlayerId === playerId && isParticipant;
  const ownArtwork = match.round.artworksByPlayerId[playerId] ?? null;
  const isArtist = Boolean(ownArtwork) && isParticipant;
  const revealImage =
    match.round.phase === 'voting' ||
    match.round.phase === 'round-results' ||
    match.round.phase === 'completed';
  const counts = resultCounts(match);
  const resultPhase = match.round.phase === 'round-results' || match.round.phase === 'completed';
  const highestScore = Math.max(0, ...Object.values(match.scores));
  return {
    gameId: EYEWITNESS_GAME_ID,
    selfPlayerId: playerId,
    settings: { ...match.settings },
    phase: match.round.phase,
    currentRound: match.currentRound,
    totalRounds: match.settings.roundCount,
    roundId: match.round.roundId,
    witnessPlayerId: match.round.witnessPlayerId,
    witnessName: match.playerNames[match.round.witnessPlayerId] ?? 'لاعب',
    isWitness,
    isArtist,
    isSpectator: !isParticipant,
    isHost: shell.hostPlayerId === playerId,
    canEditDescription:
      isWitness && match.round.phase === 'witness' && match.round.deadlineAtMs !== null,
    canSubmitDescription:
      isWitness && match.round.phase === 'witness' && match.round.deadlineAtMs !== null,
    canDraw:
      isArtist &&
      match.round.phase === 'drawing' &&
      !ownArtwork!.submitted &&
      match.round.deadlineAtMs !== null,
    canSubmitArtwork:
      isArtist &&
      match.round.phase === 'drawing' &&
      !ownArtwork!.submitted &&
      match.round.deadlineAtMs !== null,
    canVote: isParticipant && match.round.phase === 'voting' && match.round.deadlineAtMs !== null,
    canAdvance: shell.hostPlayerId === playerId && match.round.phase === 'round-results',
    privateReferenceImageDataUrl:
      isWitness && match.round.phase === 'witness'
        ? getEyewitnessImageDataUrl(match.round.imageId)
        : null,
    revealedReferenceImageDataUrl: revealImage
      ? getEyewitnessImageDataUrl(match.round.imageId)
      : null,
    ownDescriptionDraft:
      isWitness && match.round.phase === 'witness' ? match.round.descriptionDraft : null,
    lockedDescription: match.round.phase === 'witness' ? null : match.round.lockedDescription,
    ownArtworkId: ownArtwork?.artworkId ?? null,
    ownStrokes:
      ownArtwork && match.round.phase === 'drawing' ? cloneStrokes(ownArtwork.strokes) : [],
    ownArtworkSubmitted: ownArtwork?.submitted ?? false,
    submittedArtworkCount: Object.values(match.round.artworksByPlayerId).filter(
      (artwork) => artwork.submitted,
    ).length,
    eligibleArtistCount: match.round.artistPlayerIds.length,
    anonymousArtworks:
      match.round.phase === 'voting'
        ? match.round.artworkOrder.map((artworkId) => {
            const artwork = Object.values(match.round.artworksByPlayerId).find(
              (entry) => entry.artworkId === artworkId,
            )!;
            return { artworkId, strokes: cloneStrokes(artwork.strokes) };
          })
        : [],
    confirmedArtworkId:
      match.round.phase === 'voting' ? (match.round.votesByPlayerId[playerId] ?? null) : null,
    resultArtworks: resultPhase
      ? match.round.artworkOrder.map((artworkId) => {
          const artwork = Object.values(match.round.artworksByPlayerId).find(
            (entry) => entry.artworkId === artworkId,
          )!;
          return {
            artworkId,
            strokes: cloneStrokes(artwork.strokes),
            artistPlayerId: artwork.artistPlayerId,
            artistName: match.playerNames[artwork.artistPlayerId] ?? 'لاعب',
            voteCount: counts.get(artworkId) ?? 0,
            isRoundWinner: match.round.roundWinnerArtworkIds.includes(artworkId),
          };
        })
      : [],
    leaderboard: resultPhase
      ? match.playerIds.map((id) => ({
          playerId: id,
          playerName: match.playerNames[id] ?? 'لاعب',
          wins: match.scores[id] ?? 0,
          isMatchWinner:
            match.round.phase === 'completed' && (match.scores[id] ?? 0) === highestScore,
        }))
      : [],
    roundWinnerArtworkIds: resultPhase ? [...match.round.roundWinnerArtworkIds] : [],
    resultReason: resultPhase ? match.round.resultReason : null,
    deadlineAtMs: match.round.deadlineAtMs,
    remainingSeconds:
      match.round.deadlineAtMs === null
        ? null
        : Math.max(0, Math.ceil((match.round.deadlineAtMs - now) / 1000)),
    waitingForWitness: match.round.phase === 'witness' && match.round.deadlineAtMs === null,
  };
}
