import { supabaseAdmin } from "../supabase.js";

async function getAuthenticatedSupabaseUser(accessToken) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error(error?.message || "Invalid Supabase session");
  }

  return data.user;
}

async function getActiveMembershipForUser(userId) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("default_organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  let membershipQuery = supabaseAdmin
    .from("organization_members")
    .select("id, organization_id, user_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (profile?.default_organization_id) {
    membershipQuery = membershipQuery.eq("organization_id", profile.default_organization_id);
  } else {
    membershipQuery = membershipQuery.order("created_at", { ascending: true }).limit(1);
  }

  const { data: member, error } = await membershipQuery.maybeSingle();

  if (error || !member) {
    throw new Error(error?.message || "Membership not found");
  }

  return member;
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!accessToken) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ message: "SUPABASE_SERVICE_ROLE_KEY is required for protected API routes" });
    }

    const user = await getAuthenticatedSupabaseUser(accessToken);
    const member = await getActiveMembershipForUser(user.id);

    req.auth = {
      userId: member.user_id,
      organizationId: member.organization_id,
      role: member.role,
      user: member,
      supabaseUser: user,
    };

    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
}

export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action" });
    }
    return next();
  };
}
