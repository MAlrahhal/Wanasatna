import { Router } from "express";
import { SERVER_BUILD_META } from "../config/build-meta.js";
import { publicHealthHandler } from "../lib/public-health.js";
import { adminRouter } from "../modules/admin/admin.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { listGameAvailability } from "../modules/game/game-availability.service.js";
import { isRoomCurrentlyReturnable } from "../modules/room/services/room-returnability.service.js";

/**
 * Root API router. Feature routes will be mounted here as they are built.
 */
export const apiRouter = Router();

apiRouter.get("/health", publicHealthHandler);

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

apiRouter.use("/auth", authRouter);
apiRouter.use("/admin", adminRouter);

apiRouter.get("/rooms/:code/returnable", async (req, res) => {
  const code = String(req.params.code ?? "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) {
    res.status(200).json({ success: true, data: { returnable: false } });
    return;
  }

  try {
    const returnable = await isRoomCurrentlyReturnable(code);
    res.status(200).json({ success: true, data: { returnable } });
  } catch {
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "تعذر التحقق من الغرفة." },
    });
  }
});

apiRouter.get("/games/availability", async (_req, res) => {
  try {
    const data = await listGameAvailability();
    res.status(200).json({ success: true, data });
  } catch {
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "تعذر تحميل حالة الألعاب." },
    });
  }
});
