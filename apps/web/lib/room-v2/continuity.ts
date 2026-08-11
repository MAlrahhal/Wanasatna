/**
 * Browser-runtime continuity probe (test/dev/prod diagnostics).
 * Proves soft App Router navigation vs full document reload.
 * Never logs reconnect tokens.
 */

const RUNTIME_ID_KEY = '__wanasatna_runtime_id__';
const LIFECYCLE_KEY = '__wanasatna_lifecycle__';
const RECONNECT_COUNT_KEY = '__wanasatna_reconnect_emit_count__';
const MANAGER_ID_KEY = '__wanasatna_manager_instance_id__';

type ContinuityGlobal = typeof globalThis & {
  [RUNTIME_ID_KEY]?: string;
  [LIFECYCLE_KEY]?: ContinuityEvent[];
  [RECONNECT_COUNT_KEY]?: number;
  [MANAGER_ID_KEY]?: string;
};

export type ContinuityEvent = {
  ts: number;
  event: string;
  runtimeId: string;
  socketId: string | null;
  managerId?: string | null;
  roomCode?: string | null;
  playerId?: string | null;
  status?: string | null;
  detail?: string | null;
};

const MAX_EVENTS = 80;

export function getRuntimeId(): string {
  if (typeof window === 'undefined') {
    return 'ssr';
  }

  const g = globalThis as ContinuityGlobal;
  if (!g[RUNTIME_ID_KEY]) {
    g[RUNTIME_ID_KEY] =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `rt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return g[RUNTIME_ID_KEY]!;
}

export function ensureManagerInstanceId(holder: { __instanceId?: string }): string {
  if (!holder.__instanceId) {
    holder.__instanceId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `mgr-${Date.now()}`;
  }

  if (typeof window !== 'undefined') {
    (globalThis as ContinuityGlobal)[MANAGER_ID_KEY] = holder.__instanceId;
  }

  return holder.__instanceId;
}

export function bumpReconnectEmitCount(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  const g = globalThis as ContinuityGlobal;
  g[RECONNECT_COUNT_KEY] = (g[RECONNECT_COUNT_KEY] ?? 0) + 1;
  return g[RECONNECT_COUNT_KEY]!;
}

export function getReconnectEmitCount(): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  return (globalThis as ContinuityGlobal)[RECONNECT_COUNT_KEY] ?? 0;
}

export function resetReconnectEmitCount(): void {
  if (typeof window === 'undefined') {
    return;
  }
  (globalThis as ContinuityGlobal)[RECONNECT_COUNT_KEY] = 0;
}

export function recordContinuity(
  event: string,
  data: {
    socketId?: string | null;
    managerId?: string | null;
    roomCode?: string | null;
    playerId?: string | null;
    status?: string | null;
    detail?: string | null;
  } = {},
): ContinuityEvent {
  const entry: ContinuityEvent = {
    ts: Date.now(),
    event,
    runtimeId: getRuntimeId(),
    socketId: data.socketId ?? null,
    managerId: data.managerId ?? null,
    roomCode: data.roomCode ?? null,
    playerId: data.playerId ?? null,
    status: data.status ?? null,
    detail: data.detail ?? null,
  };

  if (typeof window !== 'undefined') {
    const g = globalThis as ContinuityGlobal;
    const list = g[LIFECYCLE_KEY] ?? [];
    list.push(entry);
    while (list.length > MAX_EVENTS) {
      list.shift();
    }
    g[LIFECYCLE_KEY] = list;
  }

  return entry;
}

export function getContinuityLog(): ContinuityEvent[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return [...((globalThis as ContinuityGlobal)[LIFECYCLE_KEY] ?? [])];
}
