import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json());

  app.use("/api", apiRouter);

  return app;
}
