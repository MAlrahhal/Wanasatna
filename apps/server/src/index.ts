import { createServer } from "http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createSocketServer } from "./sockets/index.js";

const app = createApp();
const httpServer = createServer(app);

createSocketServer(httpServer);

httpServer.listen(env.port, () => {
  console.log(`[server] listening on port ${env.port} (${env.nodeEnv})`);
});
