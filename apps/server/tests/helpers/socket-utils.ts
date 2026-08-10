import type { Socket } from 'socket.io-client';
import { io as ioClient } from 'socket.io-client';
import type { BaraAlSalafaPlayerView } from '@wanasatna/shared';
import { BARA_AL_SALAFA_SYNC_EVENT, GAME_SHELL_PLAYER_RECOVERY_EVENT } from '@wanasatna/shared';

export const DEFAULT_SERVER_URL = process.env.WANASATNA_TEST_SERVER_URL ?? 'http://localhost:4001';

export const IMPOSTOR_TEXT = 'أنت برا السالفة';

export const PLAYER_NAMES = [
  'محمد',
  'خالد',
  'علي',
  'سارة',
  'فهد',
  'نورة',
  'عمر',
  'ريم',
] as const;

export type RosterPlayer = {
  id: string;
  name: string;
  status: string;
  isHost: boolean;
};

export type TestClient = {
  name: string;
  socket: Socket;
  id: string;
  roomId: string;
  roomCode: string;
  reconnectToken: string;
  shellEvents: Array<{ phase: string; countdown: number | null }>;
  roster: string[];
  rosterPlayers: RosterPlayer[];
  navigations: string[];
  recoveryEvents: Array<{
    isActive: boolean;
    remainingSeconds: number;
    connectedCount: number;
    minimumCount: number;
    sequence: number;
  }>;
};

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function ack<T = unknown>(socket: Socket, event: string, payload: unknown = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(15000).emit(event, payload, (err: Error | null, res: T) =>
      err ? reject(err) : resolve(res),
    );
  });
}

export async function connectClient(serverUrl = DEFAULT_SERVER_URL): Promise<Socket> {
  const socket = ioClient(serverUrl, { autoConnect: true });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

export function trackClientEvents(client: TestClient): void {
  client.socket.on('game-shell-state', (payload: { state: { phase: string; countdownRemainingSeconds: number | null } }) => {
    client.shellEvents.push({
      phase: payload.state.phase,
      countdown: payload.state.countdownRemainingSeconds,
    });
  });

  client.socket.on(
    'room-players-snapshot',
    (payload: {
      roomId?: string;
      players: Array<{ id: string; name: string; status: string; isHost: boolean }>;
    }) => {
      client.roster.length = 0;
      client.roster.push(...payload.players.map((p) => p.name).sort());
      client.rosterPlayers = payload.players.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        isHost: p.isHost,
      }));
    },
  );

  client.socket.on('game-shell-navigate', (payload: { path: string }) => {
    client.navigations.push(payload.path);
  });

  client.socket.on(GAME_SHELL_PLAYER_RECOVERY_EVENT, (payload) => {
    client.recoveryEvents.push(payload);
  });
}

export async function syncView(socket: Socket): Promise<BaraAlSalafaPlayerView> {
  const res = await ack<{ success: boolean; data?: { view: BaraAlSalafaPlayerView }; error?: { code: string; message: string } }>(
    socket,
    BARA_AL_SALAFA_SYNC_EVENT,
    {},
  );
  if (!res.success || !res.data?.view) {
    throw new Error(`plugin sync failed: ${res.error?.code ?? 'UNKNOWN'} ${res.error?.message ?? ''}`);
  }
  return res.data.view;
}

export async function waitFor<T>(
  fn: () => Promise<T | null | false | undefined>,
  timeoutMs: number,
  label: string,
  intervalMs = 400,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) {
      return result;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timeout (${timeoutMs}ms) waiting for: ${label}`);
}

export async function waitForServer(serverUrl = DEFAULT_SERVER_URL, timeoutMs = 30000): Promise<void> {
  const healthUrl = `${serverUrl.replace(/\/$/, '')}/api/health`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error(`Server not reachable at ${healthUrl}`);
}
