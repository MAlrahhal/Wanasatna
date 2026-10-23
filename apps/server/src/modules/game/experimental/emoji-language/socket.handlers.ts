import type { Prisma } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import type {
  EmojiLanguageGuessFeedback,
  EmojiLanguageLobbyView,
  EmojiLanguagePlayerView,
  EmojiLanguageSubmitCluePayload,
  EmojiLanguageSubmitGuessPayload,
  GameActionResponse,
} from '@wanasatna/shared';
import {
  EMOJI_LANGUAGE_GAME_ID,
  EMOJI_LANGUAGE_LOBBY_SYNC_EVENT,
  EMOJI_LANGUAGE_MIN_PLAYERS,
  EMOJI_LANGUAGE_PHASE_CHANGED_EVENT,
  EMOJI_LANGUAGE_SUBMIT_CLUE_EVENT,
  EMOJI_LANGUAGE_SUBMIT_GUESS_EVENT,
  EMOJI_LANGUAGE_SYNC_EVENT,
  EMOJI_LANGUAGE_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { prisma } from '../../../../lib/prisma.js';
import { resolveSocketAccountUser } from '../../../auth/socket-auth.js';
import { getRoomChannel, loadActiveRoomPlayers } from '../../../room/room.utils.js';
import { lockRoomRow } from '../../../room/services/room-tx.js';
import { getGameShellByRoomId } from '../../game.service.js';
import {
  getGameSocketContext,
  rejectIfGameSyncRateLimited,
  sendGameInternalError,
  sendGameResponse,
} from '../../game.socket.utils.js';
import {
  authorizeExperimentalGameStartLocked,
  preflightExperimentalGameStart,
} from '../experimental-game-access.service.js';
import {
  getExperimentalGameSelection,
  hydrateExperimentalGameSelection,
} from '../experimental-game-selection.store.js';
import { ensureEmojiLanguageMatch } from './init-match.js';
import {
  getEmojiLanguageLobbySettings,
  hydrateEmojiLanguageLobbySettings,
  persistEmojiLanguageSettings,
  setEmojiLanguageLobbySettings,
  validateEmojiLanguageSettings,
} from './lobby-settings.js';
import { restartEmojiLanguageTimer, settleEmojiLanguageDeadline } from './phase-timer.js';
import {
  buildEmojiLanguagePlayerView,
  submitEmojiLanguageClue,
  submitEmojiLanguageGuess,
} from './state.js';
import { getEmojiLanguageMatch, setEmojiLanguageMatch } from './store.js';

function invalid(message: string): Extract<GameActionResponse<never>, { success: false }> {
  return { success: false, error: { code: 'VALIDATION_ERROR', message } };
}

function forbidden(message: string): Extract<GameActionResponse<never>, { success: false }> {
  return { success: false, error: { code: 'FORBIDDEN', message } };
}

function exactObjectKeys(payload: unknown, allowed: readonly string[]): boolean {
  return (
    Boolean(payload) &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    Object.keys(payload as object).length === allowed.length &&
    Object.keys(payload as object).every((key) => allowed.includes(key))
  );
}

async function loadLobbyContext(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { hostPlayerId: true, gameSettings: true },
  });
  if (!room) return null;
  hydrateExperimentalGameSelection(roomId, room.gameSettings);
  hydrateEmojiLanguageLobbySettings(roomId, room.gameSettings);
  const players = await loadActiveRoomPlayers(roomId, room.hostPlayerId);
  return { room, players };
}

async function buildLobbyView(socket: Socket): Promise<EmojiLanguageLobbyView | null> {
  const roomId = socket.data.roomId as string;
  const playerId = socket.data.playerId as string;
  const context = await loadLobbyContext(roomId);
  if (!context || getExperimentalGameSelection(roomId)?.gameId !== EMOJI_LANGUAGE_GAME_ID) {
    return null;
  }
  const account = await resolveSocketAccountUser(socket);
  const denied = await preflightExperimentalGameStart({
    roomId,
    playerId,
    gameId: EMOJI_LANGUAGE_GAME_ID,
    authority: {
      accountUserId: account?.id ?? null,
      accountRole: account?.role ?? null,
    },
  });
  return {
    gameId: EMOJI_LANGUAGE_GAME_ID,
    settings: getEmojiLanguageLobbySettings(roomId),
    canEditSettings: denied === null && getGameShellByRoomId(roomId) === null,
    participantCount: context.players.filter(
      (player) => player.status === 'CONNECTED' && !player.isSpectator,
    ).length,
    minPlayers: EMOJI_LANGUAGE_MIN_PLAYERS,
  };
}

async function respondLobbyView(
  socket: Socket,
  callback: ((response: GameActionResponse<{ view: EmojiLanguageLobbyView }>) => void) | undefined,
): Promise<void> {
  const view = await buildLobbyView(socket);
  if (!view) {
    sendGameResponse(callback, forbidden('هذه الغرفة ليست جلسة اختبار معتمدة للعبة.'));
    return;
  }
  sendGameResponse(callback, { success: true, data: { view } });
}

function respondMatchView(
  callback:
    | ((
        response: GameActionResponse<{
          view: EmojiLanguagePlayerView;
          feedback?: EmojiLanguageGuessFeedback;
        }>,
      ) => void)
    | undefined,
  roomId: string,
  playerId: string,
  feedback?: EmojiLanguageGuessFeedback,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getEmojiLanguageMatch(roomId);
  if (!shell || !match) {
    sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    return;
  }
  sendGameResponse(callback, {
    success: true,
    data: {
      view: buildEmojiLanguagePlayerView(match, playerId, shell),
      ...(feedback ? { feedback } : {}),
    },
  });
}

function broadcastChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(EMOJI_LANGUAGE_PHASE_CHANGED_EVENT, {});
}

async function updatePersistedSettings(
  socket: Socket,
  settings: ReturnType<typeof getEmojiLanguageLobbySettings>,
): Promise<Extract<GameActionResponse<never>, { success: false }> | null> {
  const roomId = socket.data.roomId!;
  const playerId = socket.data.playerId!;
  const account = await resolveSocketAccountUser(socket);
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (!(await lockRoomRow(tx, roomId))) return invalid('الغرفة غير موجودة.');
    const denied = await authorizeExperimentalGameStartLocked(tx, {
      roomId,
      playerId,
      gameId: EMOJI_LANGUAGE_GAME_ID,
      authority: {
        accountUserId: account?.id ?? null,
        accountRole: account?.role ?? null,
      },
    });
    if (denied) return denied;
    if (getGameShellByRoomId(roomId)) return invalid('لا يمكن تعديل الإعدادات بعد بدء المباراة.');
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: { gameSettings: true },
    });
    if (!room) return invalid('الغرفة غير موجودة.');
    await tx.room.update({
      where: { id: roomId },
      data: { gameSettings: persistEmojiLanguageSettings(room.gameSettings, settings) },
    });
    return null;
  });
  if (!result) setEmojiLanguageLobbySettings(roomId, settings);
  return result;
}

export function registerEmojiLanguageSocketHandlers(io: Server, socket: Socket): void {
  socket.on(EMOJI_LANGUAGE_LOBBY_SYNC_EVENT, async (_payload, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (rejectIfGameSyncRateLimited(socket, callback)) return;
    try {
      await respondLobbyView(socket, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(EMOJI_LANGUAGE_UPDATE_SETTINGS_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    const parsed = validateEmojiLanguageSettings(payload);
    if (!parsed.success) return sendGameResponse(callback, invalid(parsed.error));
    try {
      const error = await updatePersistedSettings(socket, parsed.data);
      if (error) return sendGameResponse(callback, error);
      broadcastChanged(io, socket.data.roomId!);
      await respondLobbyView(socket, callback);
    } catch {
      sendGameInternalError(callback);
    }
  });

  socket.on(EMOJI_LANGUAGE_SYNC_EVENT, (_payload, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (rejectIfGameSyncRateLimited(socket, callback)) return;
    ensureEmojiLanguageMatch(io, socket.data.roomId!);
    respondMatchView(callback, socket.data.roomId!, socket.data.playerId!);
  });

  socket.on(EMOJI_LANGUAGE_SUBMIT_CLUE_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['roundId', 'emojis'])) {
      return sendGameResponse(callback, invalid('بيانات التلميح غير صالحة.'));
    }
    const roomId = socket.data.roomId!;
    const now = Date.now();
    settleEmojiLanguageDeadline(io, roomId, now);
    const match = getEmojiLanguageMatch(roomId) ?? ensureEmojiLanguageMatch(io, roomId);
    if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    const result = submitEmojiLanguageClue(
      match,
      socket.data.playerId!,
      payload as EmojiLanguageSubmitCluePayload,
      now,
    );
    if (!result.ok) return sendGameResponse(callback, invalid(result.message));
    if (result.changed) {
      setEmojiLanguageMatch(roomId, result.match);
      broadcastChanged(io, roomId);
      restartEmojiLanguageTimer(io, roomId);
    }
    respondMatchView(callback, roomId, socket.data.playerId!);
  });

  socket.on(EMOJI_LANGUAGE_SUBMIT_GUESS_EVENT, (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);
    if (contextError) return sendGameResponse(callback, contextError);
    if (!exactObjectKeys(payload, ['roundId', 'answer', 'requestId'])) {
      return sendGameResponse(callback, invalid('بيانات التخمين غير صالحة.'));
    }
    const roomId = socket.data.roomId!;
    const now = Date.now();
    settleEmojiLanguageDeadline(io, roomId, now);
    const match = getEmojiLanguageMatch(roomId) ?? ensureEmojiLanguageMatch(io, roomId);
    if (!match) return sendGameResponse(callback, invalid('اللعبة غير جاهزة بعد.'));
    const result = submitEmojiLanguageGuess(
      match,
      socket.data.playerId!,
      payload as EmojiLanguageSubmitGuessPayload,
      now,
    );
    if (!result.ok) return sendGameResponse(callback, invalid(result.message));
    if (result.changed) {
      setEmojiLanguageMatch(roomId, result.match);
      broadcastChanged(io, roomId);
    }
    respondMatchView(callback, roomId, socket.data.playerId!, result.feedback);
  });
}
