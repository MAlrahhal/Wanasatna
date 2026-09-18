import { createServer } from 'http';
import { createApp } from './app.js';
import { SERVER_BUILD_META } from './config/build-meta.js';
import { env } from './config/env.js';
import {
  runDatabaseMaintenance,
  startDatabaseMaintenanceScheduler,
  stopDatabaseMaintenanceScheduler,
} from './lib/database-maintenance.js';
import { createGracefulShutdown, registerProcessShutdownSignals } from './lib/graceful-shutdown.js';
import { opsLogger, sanitizeErrorName } from './lib/ops-logger.js';
import { prisma } from './lib/prisma.js';
import {
  startDisconnectedPlayerExpiryScheduler,
  stopDisconnectedPlayerExpiryScheduler,
} from './modules/room/services/disconnected-player-expiry.service.js';
import { reconcilePersistedRoomLifecycle } from './modules/room/services/room-startup-reconciliation.service.js';
import { createSocketServer } from './sockets/index.js';

async function abortStartup(error: unknown, event: string, message: string): Promise<void> {
  opsLogger.error(event, message, {
    errorName: sanitizeErrorName(error),
  });
  try {
    await prisma.$disconnect();
  } catch {
    // Ignore disconnect failure after startup abort.
  }
  process.exit(1);
}

async function start(): Promise<void> {
  try {
    await reconcilePersistedRoomLifecycle();
  } catch (error) {
    await abortStartup(
      error,
      'startup-reconciliation-failed',
      'تعذر إكمال تسوية الغرف عند التشغيل.',
    );
    return;
  }

  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);

  try {
    const recovery = await startDisconnectedPlayerExpiryScheduler(io);
    opsLogger.info('disconnected-expiry-recovered', 'Recovered disconnected player deadlines.', {
      candidates: recovery.candidates,
      expired: recovery.expired,
      scheduled: recovery.scheduled,
    });
  } catch (error) {
    io.close();
    await abortStartup(
      error,
      'disconnected-expiry-recovery-failed',
      'Failed to restore disconnected player deadlines.',
    );
    return;
  }

  await runDatabaseMaintenance();
  startDatabaseMaintenanceScheduler();

  const shutdown = createGracefulShutdown({
    io,
    httpServer,
    prisma,
    exit: (code) => process.exit(code),
    beforeClose: () => {
      stopDisconnectedPlayerExpiryScheduler();
      stopDatabaseMaintenanceScheduler();
    },
  });
  registerProcessShutdownSignals(shutdown.requestShutdown);

  process.on('unhandledRejection', (reason) => {
    opsLogger.warn('unhandled-rejection', 'وعد غير معالج.', {
      errorName: sanitizeErrorName(reason),
    });
  });

  process.on('uncaughtException', (error) => {
    opsLogger.error('uncaught-exception', 'خطأ غير ملتقط.', {
      errorName: sanitizeErrorName(error),
    });
    void shutdown.requestShutdown();
  });

  httpServer.listen(env.port, () => {
    opsLogger.info('server-started', 'بدأ الاستماع للطلبات.', {
      port: env.port,
      environment: env.nodeEnv === 'production' ? 'production' : 'development',
      commitSha: SERVER_BUILD_META.commitSha,
      instanceId: SERVER_BUILD_META.instanceId,
    });
  });
}

void start();
