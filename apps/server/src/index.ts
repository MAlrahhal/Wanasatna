import { createServer } from "http";
import { createApp } from "./app.js";
import { SERVER_BUILD_META } from "./config/build-meta.js";
import { env } from "./config/env.js";
import { createGracefulShutdown, registerProcessShutdownSignals } from "./lib/graceful-shutdown.js";
import { prisma } from "./lib/prisma.js";
import { createSocketServer } from "./sockets/index.js";

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
