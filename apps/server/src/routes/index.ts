import { Router } from "express";
import { SERVER_BUILD_META } from "../config/build-meta.js";

/**
 * Root API router. Feature routes will be mounted here as they are built.
 */
export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/** Safe deployment identity for production isolation audits. No secrets. */
apiRouter.get("/version", (_req, res) => {
  res.json({
    service: SERVER_BUILD_META.service,
    commitSha: SERVER_BUILD_META.commitSha,
    buildTime: SERVER_BUILD_META.buildTime,
    environment: SERVER_BUILD_META.environment,
    instanceId: SERVER_BUILD_META.instanceId,
  });
});
