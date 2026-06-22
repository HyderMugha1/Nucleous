import express from "express";
import { config } from "../config.js";
import { asyncHandler, ok } from "../utils/http.js";
import { runTvAutoTranscriptionCycle } from "../modules/tv/service.js";

const router = express.Router();

function isAuthorizedCronRequest(req) {
  const authHeader = String(req.headers.authorization || "");
  if (config.cronSecret) {
    return authHeader === `Bearer ${config.cronSecret}`;
  }

  const userAgent = String(req.headers["user-agent"] || "");
  const vercelCronHeader = String(req.headers["x-vercel-cron"] || "");

  return /vercel-cron/i.test(userAgent) || vercelCronHeader === "1";
}

router.all(
  "/tv/auto-transcribe",
  asyncHandler(async (req, res) => {
    if (!isAuthorizedCronRequest(req)) {
      return res.status(401).json({ message: "Unauthorized cron request" });
    }

    const result = await runTvAutoTranscriptionCycle();
    return ok(res, {
      ok: true,
      result,
      ranAt: new Date().toISOString(),
    });
  }),
);

export default router;
