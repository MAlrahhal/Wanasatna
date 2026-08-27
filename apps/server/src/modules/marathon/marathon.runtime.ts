import { randomUUID } from 'node:crypto';
import { PlayerStatus } from '@prisma/client';
import type { Server } from 'socket.io';
import {
  MARATHON_FINAL_RESULTS_SECONDS,
  MARATHON_STATE_EVENT,
  MARATHON_TRANSITION_SECONDS,
  accumulateMarathonPoints,
  normalizeMarathonScores,
  resolveEffectiveGameSettings,
  type ContinueMarathonPayload,
  type MarathonGamePlanItem,
  type MarathonScoreEntry,
  type MarathonState,
} from '@wanasatna/shared';
import { prisma } from '../../lib/prisma.js';
import type { MatchParticipantResult } from '../match/match-history.types.js';
import { getRoomChannel } from '../room/room.utils.js';
import { getRoomGameSettings, setRoomGameSettingsCache } from '../room/room-game-settings.store.js';
import { clearRoomSpectatorFlags } from '../room/services/clear-spectators.service.js';
import { broadcastRoomPlayersSnapshot } from '../room/room.utils.js';
import { applyDrawGuessLobbySettings } from '../game/plugins/draw-guess/socket.handlers.js';
import { applyTimingChallengeLobbySettings } from '../game/plugins/timing-challenge/socket.handlers.js';
import {
  navigateRoomToGame,
  navigateRoomToLobby,
  scheduleGameShellLifecycle,
} from '../game/game.lifecycle.js';
import { broadcastGameShellState, stopGameShellTimer } from '../game/game.timer.js';
import { getGameShellByRoomId, startGameShellFromLobby } from '../game/game.service.js';
import { setRoomRoundCategory } from '../game/runtime/round-category-store.js';
import {
  deleteMarathonState,
  getMarathonState,
  hasMarathonState,
  setMarathonState,
} from './marathon.store.js';

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const advancingRooms = new Set<string>();

function nowIso(): string {
  return new Date().toISOString();
}

function leaderboard(state: MarathonState): MarathonScoreEntry[] {
  return state.participantIds
    .map((playerId) => ({
      playerId,
      playerName: state.playerNames[playerId] ?? 'لاعب',
      totalPoints: state.playerTotals[playerId] ?? 0,
      rank: 0,
    }))
    .sort(
      (left, right) =>
        right.totalPoints - left.totalPoints ||
        left.playerName.localeCompare(right.playerName, 'ar'),
    )
    .map((entry, index, entries) => ({
      ...entry,
      rank:
        index > 0 && entries[index - 1]?.totalPoints === entry.totalPoints
          ? entries[index - 1]!.rank
          : index + 1,
    }));
}

function save(state: MarathonState): MarathonState {
  const next = { ...state, revision: state.revision + 1 };
  next.leaderboard = leaderboard(next);
  setMarathonState(next);
  return next;
}

function broadcast(io: Server, state: MarathonState): void {
  io.to(getRoomChannel(state.roomId)).emit(MARATHON_STATE_EVENT, { state });
}

function clearTimer(roomId: string): void {
  const timer = timers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(roomId);
  }
}

export function isMarathonActive(roomId: string): boolean {
  return hasMarathonState(roomId);
}

export function clearMarathonState(roomId: string): void {
  clearTimer(roomId);
  advancingRooms.delete(roomId);
  deleteMarathonState(roomId);
}

async function currentHost(roomId: string): Promise<string | null> {
  return (
    (await prisma.room.findUnique({ where: { id: roomId }, select: { hostPlayerId: true } }))
      ?.hostPlayerId ?? null
  );
}

export async function prepareMarathon(
  roomId: string,
  playerId: string,
): Promise<MarathonState | null> {
  if ((await currentHost(roomId)) !== playerId || getGameShellByRoomId(roomId)) {
    return null;
  }
  const existing = getMarathonState(roomId);
  if (existing) {
    return existing;
  }
  return save({
    marathonId: randomUUID(),
    roomId,
    revision: 0,
    status: 'PREPARING',
    gamePlan: [],
    currentGameIndex: -1,
    activeShellId: null,
    participantIds: [],
    playerNames: {},
    playerTotals: {},
    departedPlayerIds: [],
    completedGames: [],
    skippedGames: [],
    transitionDeadlineAtMs: null,
    startedAt: null,
    finishedAt: null,
    timerGeneration: 0,
    leaderboard: [],
  });
}

function completePlanSettings(
  plan: MarathonGamePlanItem[],
  roomId: string,
): MarathonGamePlanItem[] {
  const roomSettings = getRoomGameSettings(roomId);
  return plan.map((item) => ({
    ...item,
    configuration: {
      ...item.configuration,
      settings: resolveEffectiveGameSettings(item.gameId, {
        ...(roomSettings ?? {}),
        [item.gameId]: {
          ...(roomSettings?.[item.gameId] ?? {}),
          ...item.configuration.settings,
        },
      }),
    },
  }));
}

export async function startMarathon(
  io: Server,
  roomId: string,
  playerId: string,
  plan: MarathonGamePlanItem[],
): Promise<{ success: true; state: MarathonState } | { success: false; message: string }> {
  if ((await currentHost(roomId)) !== playerId) {
    return { success: false, message: 'المضيف الحالي فقط يمكنه بدء الماراتون.' };
  }
  const existing = getMarathonState(roomId);
  if (existing && existing.status !== 'PREPARING') {
    return { success: false, message: 'الماراتون بدأ بالفعل.' };
  }
  const players = await prisma.player.findMany({
    where: { roomId, status: PlayerStatus.CONNECTED, isSpectator: false },
    orderBy: { joinedAt: 'asc' },
    select: { id: true, name: true },
  });
  if (players.length === 0) {
    return { success: false, message: 'لا يوجد لاعبون متصلون لبدء الماراتون.' };
  }
  const base = existing ?? (await prepareMarathon(roomId, playerId));
  if (!base) {
    return { success: false, message: 'تعذر تجهيز الماراتون.' };
  }
  const state = save({
    ...base,
    status: 'PLAYING',
    gamePlan: completePlanSettings(plan, roomId),
    participantIds: players.map((entry) => entry.id),
    playerNames: Object.fromEntries(players.map((entry) => [entry.id, entry.name])),
    playerTotals: Object.fromEntries(players.map((entry) => [entry.id, 0])),
    startedAt: nowIso(),
  });
  const started = await startNextPlayableLeg(io, state, 0);
  return { success: true, state: started };
}

function applyConfiguration(
  roomId: string,
  item: MarathonGamePlanItem,
  eligibleIds: string[],
): string | null {
  setRoomGameSettingsCache(roomId, { [item.gameId]: item.configuration.settings });
  setRoomRoundCategory(roomId, item.configuration.categoryId);
  if (item.gameId === 'timing-challenge') {
    const result = applyTimingChallengeLobbySettings(roomId, item.configuration.timingChallenge);
    return result.success ? null : result.error;
  }
  if (item.gameId === 'draw-guess') {
    const result = applyDrawGuessLobbySettings(
      roomId,
      item.configuration.drawGuess ?? { drawerMode: 'random' },
      eligibleIds,
    );
    return result.success ? null : result.error;
  }
  return null;
}

async function finishMarathon(io: Server, state: MarathonState): Promise<MarathonState> {
  const next = save({
    ...state,
    status: 'FINISHED',
    activeShellId: null,
    transitionDeadlineAtMs: Date.now() + MARATHON_FINAL_RESULTS_SECONDS * 1000,
    finishedAt: nowIso(),
    timerGeneration: state.timerGeneration + 1,
  });
  broadcast(io, next);
  scheduleAdvance(io, next);
  return next;
}

async function startNextPlayableLeg(
  io: Server,
  state: MarathonState,
  fromIndex: number,
): Promise<MarathonState> {
  if (advancingRooms.has(state.roomId)) {
    return getMarathonState(state.roomId) ?? state;
  }
  advancingRooms.add(state.roomId);
  try {
    return await startNextPlayableLegUnlocked(io, state, fromIndex);
  } finally {
    advancingRooms.delete(state.roomId);
  }
}

async function startNextPlayableLegUnlocked(
  io: Server,
  state: MarathonState,
  fromIndex: number,
): Promise<MarathonState> {
  clearTimer(state.roomId);
  for (let index = fromIndex; index < state.gamePlan.length; index += 1) {
    const latest = getMarathonState(state.roomId);
    if (!latest || latest.marathonId !== state.marathonId) {
      return state;
    }
    const connected = await prisma.player.findMany({
      where: {
        roomId: state.roomId,
        id: { in: state.participantIds.filter((id) => !latest.departedPlayerIds.includes(id)) },
        status: PlayerStatus.CONNECTED,
      },
      select: { id: true },
    });
    const eligibleIds = connected.map((entry) => entry.id);
    const item = latest.gamePlan[index]!;
    const configurationError = applyConfiguration(state.roomId, item, eligibleIds);
    const hostPlayerId = await currentHost(state.roomId);
    const response =
      !configurationError && hostPlayerId
        ? await startGameShellFromLobby(state.roomId, hostPlayerId, item.gameId, {
            skipSettingsHydration: true,
          })
        : null;
    if (!response?.success) {
      state = save({
        ...latest,
        currentGameIndex: index,
        skippedGames: [
          ...latest.skippedGames,
          {
            gameIndex: index,
            gameId: item.gameId,
            reason:
              configurationError ??
              (response && !response.success ? response.error.message : 'لا يوجد مضيف متصل.'),
          },
        ],
      });
      continue;
    }
    state = save({
      ...latest,
      status: 'PLAYING',
      currentGameIndex: index,
      activeShellId: response.data.state.shellId,
      transitionDeadlineAtMs: null,
    });
    stopGameShellTimer(state.roomId);
    broadcastGameShellState(io, response.data.state);
    broadcast(io, state);
    navigateRoomToGame(io, state.roomId);
    scheduleGameShellLifecycle(io, state.roomId, response.data.state.shellId);
    return state;
  }
  return finishMarathon(io, getMarathonState(state.roomId) ?? state);
}

export function recordCompletedMarathonLeg(
  roomId: string,
  shellId: string,
  results: MatchParticipantResult[],
): MarathonState | null {
  const state = getMarathonState(roomId);
  if (!state || state.status !== 'PLAYING' || state.activeShellId !== shellId) {
    return null;
  }
  const participantSet = new Set(state.participantIds);
  const raw = state.participantIds.map((playerId) => ({
    playerId,
    score: results.find((entry) => entry.playerId === playerId)?.score ?? 0,
  }));
  const scores = normalizeMarathonScores(raw.filter((entry) => participantSet.has(entry.playerId)));
  const totals = accumulateMarathonPoints(state.playerTotals, scores);
  return save({
    ...state,
    status: 'TRANSITION',
    playerTotals: totals,
    completedGames: [
      ...state.completedGames,
      {
        gameIndex: state.currentGameIndex,
        gameId: state.gamePlan[state.currentGameIndex]!.gameId,
        shellId,
        scores,
      },
    ],
    transitionDeadlineAtMs: Date.now() + MARATHON_TRANSITION_SECONDS * 1000,
    timerGeneration: state.timerGeneration + 1,
  });
}

export function activateMarathonTransition(io: Server, state: MarathonState): void {
  broadcast(io, state);
  io.to(getRoomChannel(state.roomId)).emit('game-shell-navigate', {
    path: '/marathon',
    roomId: state.roomId,
  });
  scheduleAdvance(io, state);
}

export function recordAbortedMarathonLeg(
  io: Server,
  roomId: string,
  shellId: string,
  reason: string,
): MarathonState | null {
  const state = getMarathonState(roomId);
  if (!state || state.status !== 'PLAYING' || state.activeShellId !== shellId) {
    return null;
  }
  const item = state.gamePlan[state.currentGameIndex];
  if (!item) {
    return null;
  }
  const transition = save({
    ...state,
    status: 'TRANSITION',
    skippedGames: [
      ...state.skippedGames,
      { gameIndex: state.currentGameIndex, gameId: item.gameId, reason },
    ],
    transitionDeadlineAtMs: Date.now() + MARATHON_TRANSITION_SECONDS * 1000,
    timerGeneration: state.timerGeneration + 1,
  });
  activateMarathonTransition(io, transition);
  return transition;
}

function scheduleAdvance(io: Server, state: MarathonState): void {
  clearTimer(state.roomId);
  const generation = state.timerGeneration;
  const delay = Math.max(0, (state.transitionDeadlineAtMs ?? Date.now()) - Date.now());
  timers.set(
    state.roomId,
    setTimeout(() => {
      timers.delete(state.roomId);
      const latest = getMarathonState(state.roomId);
      if (
        !latest ||
        latest.marathonId !== state.marathonId ||
        latest.timerGeneration !== generation
      ) {
        return;
      }
      if (latest.status === 'FINISHED') {
        void returnMarathonToLobby(io, latest.roomId);
      } else {
        void startNextPlayableLeg(io, latest, latest.currentGameIndex + 1);
      }
    }, delay),
  );
}

export async function continueMarathon(
  io: Server,
  roomId: string,
  playerId: string,
  guard: ContinueMarathonPayload,
): Promise<MarathonState | null> {
  const state = getMarathonState(roomId);
  if (
    !state ||
    (await currentHost(roomId)) !== playerId ||
    state.marathonId !== guard.marathonId ||
    state.currentGameIndex !== guard.currentGameIndex ||
    state.activeShellId !== guard.activeShellId
  ) {
    return null;
  }
  if (state.status === 'TRANSITION') {
    return startNextPlayableLeg(io, state, state.currentGameIndex + 1);
  }
  if (state.status === 'FINISHED') {
    await returnMarathonToLobby(io, roomId);
    return state;
  }
  return null;
}

export async function returnMarathonToLobby(io: Server, roomId: string): Promise<void> {
  if (!hasMarathonState(roomId)) {
    return;
  }
  clearTimer(roomId);
  await clearRoomSpectatorFlags(roomId);
  await broadcastRoomPlayersSnapshot(io, roomId);
  deleteMarathonState(roomId);
  navigateRoomToLobby(io, roomId);
}

export function markMarathonPlayerDeparted(roomId: string, playerId: string): void {
  const state = getMarathonState(roomId);
  if (
    !state ||
    !state.participantIds.includes(playerId) ||
    state.departedPlayerIds.includes(playerId)
  ) {
    return;
  }
  save({ ...state, departedPlayerIds: [...state.departedPlayerIds, playerId] });
}
