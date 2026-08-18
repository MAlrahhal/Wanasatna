import { opsLogger, sanitizeErrorName } from './ops-logger.js';

export type ClosableServer = {
  close: (callback?: (err?: Error) => void) => void;
};

export type DisconnectablePrisma = {
  $disconnect: () => Promise<void>;
};

export type GracefulShutdownDeps = {
  io: ClosableServer;
  httpServer: ClosableServer;
  prisma: DisconnectablePrisma;
  exit: (code: number) => void;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
  fallbackMs?: number;
};

export const GRACEFUL_SHUTDOWN_FALLBACK_MS = 8_000;

function closeServer(server: ClosableServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function createGracefulShutdown(deps: GracefulShutdownDeps) {
  let shutdownPromise: Promise<void> | null = null;
  const fallbackMs = deps.fallbackMs ?? GRACEFUL_SHUTDOWN_FALLBACK_MS;
  const setTimer = deps.setTimer ?? setTimeout;
  const clearTimer = deps.clearTimer ?? clearTimeout;

  async function runShutdown(): Promise<void> {
    opsLogger.info('server-shutdown', 'بدأ إغلاق الخادم.');
    let forced = false;
    const fallback = setTimer(() => {
      forced = true;
      opsLogger.error('server-shutdown-forced', 'انتهت مهلة الإغلاق الآمن.');
      deps.exit(1);
    }, fallbackMs);

    try {
      await closeServer(deps.io);
      opsLogger.info('socket-io-closed', 'أُغلق Socket.IO.');
      await closeServer(deps.httpServer);
      opsLogger.info('http-closed', 'أُغلق خادم HTTP.');
      await deps.prisma.$disconnect();
      opsLogger.info('prisma-disconnected', 'أُغلق اتصال قاعدة البيانات.');
      if (!forced) {
        clearTimer(fallback);
        deps.exit(0);
      }
    } catch (error) {
      opsLogger.error('server-shutdown-failed', 'تعذر إكمال الإغلاق الآمن.', {
        errorName: sanitizeErrorName(error),
      });
      try {
        await deps.prisma.$disconnect();
      } catch {
        /* Prisma may already be gone */
      }
      if (!forced) {
        clearTimer(fallback);
        deps.exit(1);
      }
    }
  }

  function requestShutdown(): Promise<void> {
    if (!shutdownPromise) {
      shutdownPromise = runShutdown();
    }

    return shutdownPromise;
  }

  return { requestShutdown };
}

export function registerProcessShutdownSignals(
  requestShutdown: () => Promise<void>,
  subscribe: (
    event: 'SIGTERM' | 'SIGINT',
    handler: () => void,
  ) => void = (event, handler) => {
    process.on(event, handler);
  },
): void {
  const onSignal = () => {
    void requestShutdown();
  };

  subscribe('SIGTERM', onSignal);
  subscribe('SIGINT', onSignal);
}
