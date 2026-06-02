import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ok } from "../utils/http.js";

const router = express.Router();
router.use(requireAuth);

router.post(
  "/seed",
  asyncHandler(async (_req, res) => {
    return ok(res, {
      success: true,
      message: "Supabase signup flow now creates the default organization records. Dedicated reseed is no longer required.",
    });
  }),
);

export default router;
