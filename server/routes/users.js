import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { parsePagination } from "../utils/query.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializeUser(item) {
  return {
    _id: item.user_id,
    fullName: item.full_name,
    email: item.email,
    contactNumber: item.contact_number,
    preferredLoginProvider: item.preferred_login_provider,
    status: item.status,
    role: item.role,
    lastLoginAt: item.last_login_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const membershipResponse = await supabaseAdmin
      .from("organization_members")
      .select("user_id, role, status, created_at, updated_at", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .range(skip, skip + limit - 1);

    const memberships = membershipResponse.data || [];
    const userIds = memberships.map((item) => item.user_id);
    const profiles = userIds.length > 0
      ? await supabaseAdmin.from("profiles").select("user_id, full_name, email, contact_number, preferred_login_provider, status, last_login_at, created_at, updated_at").in("user_id", userIds)
      : { data: [] };

    const profileMap = new Map((profiles.data || []).map((profile) => [profile.user_id, profile]));
    const items = memberships
      .map((membership) => {
        const profile = profileMap.get(membership.user_id);
        if (!profile) return null;
        return serializeUser({ ...profile, role: membership.role });
      })
      .filter(Boolean);

    return ok(res, {
      items,
      pagination: { page, limit, total: membershipResponse.count || 0, pages: Math.max(1, Math.ceil((membershipResponse.count || 0) / limit)) },
    });
  }),
);

router.post(
  "/",
  requireRole(["admin", "manager", "owner"]),
  asyncHandler(async (req, res) => {
    const { fullName, email, password, contactNumber, role, preferredLoginProvider, status } = req.body;
    if (!fullName || !email || !password || !contactNumber) {
      return res.status(400).json({ message: "Missing required user fields" });
    }

    const emailLower = String(email).trim().toLowerCase();
    const { data: existing } = await supabaseAdmin.from("profiles").select("user_id").eq("email", emailLower).maybeSingle();
    if (existing) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailLower,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError || !authUser.user) {
      return res.status(400).json({ message: authError?.message || "Unable to create user" });
    }

    const userId = authUser.user.id;

    await supabaseAdmin.from("profiles").insert({
      user_id: userId,
      full_name: fullName,
      email: emailLower,
      contact_number: contactNumber,
      preferred_login_provider: preferredLoginProvider || "email",
      status: status || "active",
      default_organization_id: req.auth.organizationId,
    });

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("organization_members")
      .insert({
        organization_id: req.auth.organizationId,
        user_id: userId,
        role: role || "analyst",
        status: status || "active",
        invited_by: req.auth.userId,
      })
      .select("user_id, role, status, created_at, updated_at")
      .single();

    if (membershipError || !membership) {
      return res.status(400).json({ message: membershipError?.message || "Unable to create membership" });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, email, contact_number, preferred_login_provider, status, last_login_at, created_at, updated_at")
      .eq("user_id", userId)
      .single();

    return created(res, { item: serializeUser({ ...profile, role: membership.role }) });
  }),
);

export default router;
