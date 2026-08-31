import cors from 'cors';
import express, { type Express } from 'express';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { createRequireTrustedMutationOrigin } from './lib/origin-policy.js';
import { publicHealthHandler } from './lib/public-health.js';
import { attachOptionalAuth } from './modules/auth/auth.middleware.js';
import { apiRouter } from './routes/index.js';

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin:
        env.nodeEnv === 'development'
          ? [env.clientOrigin, /^http:\/\/localhost:\d+$/]
          : env.clientOrigin,
      credentials: true,
    }),
  );
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID();
    next();
  });
  app.use(
    '/api',
    createRequireTrustedMutationOrigin({
      nodeEnv: env.nodeEnv,
      clientOrigin: env.clientOrigin,
    }),
  );
  app.use(express.json());
  app.use(attachOptionalAuth);

  app.get('/health', publicHealthHandler);
  app.use('/api', apiRouter);

  return app;
}
