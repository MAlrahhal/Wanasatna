import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env.js";
import { attachOptionalAuth } from "./modules/auth/auth.middleware.js";
import { apiRouter } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin:
        env.nodeEnv === "development"
          ? [env.clientOrigin, /^http:\/\/localhost:\d+$/]
          : env.clientOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(attachOptionalAuth);

  app.use("/api", apiRouter);

  return app;
}
