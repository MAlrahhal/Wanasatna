import { createServer } from "http";
import { createApp } from "./app.js";
import { SERVER_BUILD_META } from "./config/build-meta.js";
import { env } from "./config/env.js";
import { createGracefulShutdown, registerProcessShutdownSignals } from "./lib/graceful-shutdown.js";
import { opsLogger, sanitizeErrorName } from "./lib/ops-logger.js";
import { prisma } from "./lib/prisma.js";
import { purgeExpiredAuthSessions } from "./modules/auth/auth-session-cleanup.js";
import { reconcilePersistedRoomLifecycle } from "./modules/room/services/room-startup-reconciliation.service.js";
import { createSocketServer } from "./sockets/index.js";

async function start(): Promise<void> {
  try {
    await reconcilePersistedRoomLifecycle();
  } catch (error) {
    opsLogger.error("startup-reconciliation-failed", "تعذر إكمال تسوية الغرف عند التشغيل.", {
      errorName: sanitizeErrorName(error),
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
    opsLogger.info("auth-session-cleanup", "تم حذف جلسات الدخول المنتهية.", {
      expiredAuthSessionsPurged,
    });
  } catch (error) {
    opsLogger.error("auth-session-cleanup-failed", "تعذر تنظيف جلسات الدخول المنتهية.", {
      errorName: sanitizeErrorName(error),
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

  process.on("unhandledRejection", (reason) => {
    opsLogger.warn("unhandled-rejection", "وعد غير معالج.", {
      errorName: sanitizeErrorName(reason),
    });
  });

  process.on("uncaughtException", (error) => {
    opsLogger.error("uncaught-exception", "خطأ غير ملتقط.", {
      errorName: sanitizeErrorName(error),
    });
    void shutdown.requestShutdown();
  });

  httpServer.listen(env.port, () => {
    opsLogger.info("server-started", "بدأ الاستماع للطلبات.", {
      port: env.port,
      environment: env.nodeEnv === "production" ? "production" : "development",
      commitSha: SERVER_BUILD_META.commitSha,
      instanceId: SERVER_BUILD_META.instanceId,
    });
  });
}

void start();
