import { Router } from "express";

/**
 * Root API router. Feature routes will be mounted here as they are built.
 */
export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true });
});
