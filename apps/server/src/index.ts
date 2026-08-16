import { createServer } from "http";
import { createApp } from "./app.js";
import { SERVER_BUILD_META } from "./config/build-meta.js";
import { env } from "./config/env.js";
import { createGracefulShutdown, registerProcessShutdownSignals } from "./lib/graceful-shutdown.js";
import { prisma } from "./lib/prisma.js";
import { purgeExpiredAuthSessions } from "./modules/auth/auth-session-cleanup.js";
import { reconcilePersistedRoomLifecycle } from "./modules/room/services/room-startup-reconciliation.service.js";
import { createSocketServer } from "./sockets/index.js";

async function start(): Promise<void> {
  try {
    await reconcilePersistedRoomLifecycle();
  } catch (error) {
    console.error("[room-lifecycle]", {
      stage: "startup-reconciliation-failed",
      errorName: error instanceof Error ? error.name : typeof error,
    });
    try {
      await prisma.$disconnect();
    } catch {
      // ignore disconnect failure after startup abort
    }
    process.exit(1);
    return;
  }

  try {
    const expiredAuthSessionsPurged = await purgeExpiredAuthSessions();
    console.info("[auth-session]", {
      stage: "startup-expired-purged",
      expiredAuthSessionsPurged,
    });
  } catch (error) {
    console.error("[auth-session]", {
      stage: "startup-expired-purge-failed",
      errorName: error instanceof Error ? error.name : typeof error,
    });
  }

  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);

  const shutdown = createGracefulShutdown({
    io,
    httpServer,
    prisma,
    exit: (code) => process.exit(code),
  });
  registerProcessShutdownSignals(shutdown.requestShutdown);

  httpServer.listen(env.port, () => {
    console.log(`[server] listening on port ${env.port} (${env.nodeEnv})`);
    console.log(
      `[server] build identity commit=${SERVER_BUILD_META.commitSha} instance=${SERVER_BUILD_META.instanceId}`,
    );
  });
}

void start();
