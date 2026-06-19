import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { config } from "../config.js";
import {
  connectTikTokAccountFromCallback,
  getTikTokConnectUrl,
  listTikTokAccounts,
  listTikTokVideos,
  syncTikTokAccountVideos,
} from "../modules/tv/service.js";
import { parsePagination } from "../utils/query.js";

const router = express.Router();

router.get(
  "/callback",
  asyncHandler(async (req, res) => {
    const code = String(req.query.code || "").trim();
    const state = String(req.query.state || "").trim();
    const clientUrl = config.clientUrl;

    if (!code || !state) {
      return res.redirect(`${clientUrl}/tv?tiktok=error`);
    }

    try {
      const result = await connectTikTokAccountFromCallback({ code, state });
      await syncTikTokAccountVideos({
        organizationId: result.organizationId,
        accountId: result.account.id,
      });
      return res.redirect(`${clientUrl}/tv?tiktok=connected`);
    } catch {
      return res.redirect(`${clientUrl}/tv?tiktok=error`);
    }
  }),
);

router.get(
  "/connect-url",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await getTikTokConnectUrl({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
    });
    return ok(res, result);
  }),
);

router.get(
  "/accounts",
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await listTikTokAccounts(req.auth.organizationId);
    return ok(res, { items });
  }),
);

router.get(
  "/videos",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query);
    const result = await listTikTokVideos({
      organizationId: req.auth.organizationId,
      accountId: req.query.accountId ? String(req.query.accountId) : null,
      page,
      limit,
    });
    return ok(res, {
      items: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.max(1, Math.ceil(result.total / limit)),
      },
    });
  }),
);

router.post(
  "/accounts/:id/sync",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await syncTikTokAccountVideos({
      organizationId: req.auth.organizationId,
      accountId: req.params.id,
    });
    return created(res, { queued: false, syncedVideos: result.videos.length });
  }),
);

export default router;
