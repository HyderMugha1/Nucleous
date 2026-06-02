import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ok } from "../utils/http.js";
import { generateModuleSummary, getLatestConversation, respondInConversation } from "../services/chatbot.js";

const router = express.Router();
router.use(requireAuth);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const contextType = req.query.contextType === "report" ? "report" : "dashboard";
    const summary = await generateModuleSummary({
      organizationId: req.auth.organizationId,
      contextType,
    });

    return ok(res, { summary });
  }),
);

router.get(
  "/conversations/latest",
  asyncHandler(async (req, res) => {
    const contextType = req.query.contextType === "report" ? "report" : "dashboard";
    const conversation = await getLatestConversation({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      contextType,
    });

    return ok(res, { conversation });
  }),
);

router.post(
  "/respond",
  asyncHandler(async (req, res) => {
    const { message, conversationId, contextRefId } = req.body;
    const contextType = req.body.contextType === "report" ? "report" : "dashboard";

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const result = await respondInConversation({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      contextType,
      contextRefId,
      conversationId,
      message: String(message).trim(),
    });

    return ok(res, result);
  }),
);

export default router;
