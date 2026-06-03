import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase, supabaseAdmin } from "../supabase.js";

const router = express.Router();
const MISSING_SERVICE_ROLE_MESSAGE =
  "The backend is missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel Project Settings -> Environment Variables and redeploy.";

function isSupabaseConnectivityError(error) {
  if (!(error instanceof Error)) return false;

  return error.message === "fetch failed" || error.cause?.code === "ENOTFOUND";
}

function getSupabaseConnectivityMessage() {
  return "Unable to reach Supabase. Check SUPABASE_URL, VITE_SUPABASE_URL, and your DNS/network connection.";
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "Unknown error";
}

function isMissingServiceRoleError(error) {
  return getErrorMessage(error).includes("SUPABASE_SERVICE_ROLE_KEY");
}

function isSupabaseAdminConfigError(error) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("invalid api key") || message.includes("invalid jwt");
}

function isWorkspaceSnapshotIncomplete(error) {
  const message = getErrorMessage(error);
  return (
    message === "Profile not found" ||
    message === "Membership not found" ||
    message === "Organization not found"
  );
}

function buildSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCompetitors(input) {
  return String(input)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPreferredLoginProvider(platform) {
  const provider = String(platform || "Email").toLowerCase();
  if (provider === "google") return "google";
  if (provider === "microsoft" || provider === "azure") return "microsoft";
  return "email";
}

async function createOrganizationSlug(company) {
  const baseSlug = buildSlug(company);
  let slug = baseSlug;
  let slugCounter = 1;

  while (true) {
    const { data: orgExists } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!orgExists) break;
    slug = `${baseSlug}-${slugCounter++}`;
  }

  return slug;
}

async function seedOrganizationDefaults({ userId, organizationId, competitorNames, role, profile }) {
  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: profile.company,
      slug: await createOrganizationSlug(profile.company),
      competitor_names: competitorNames,
      status: "active",
      created_by: userId,
    })
    .select("id, name, competitor_names")
    .single();

  if (organizationError || !organization) {
    throw new Error(organizationError?.message || "Unable to create organization");
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({
      user_id: userId,
      full_name: profile.fullName,
      email: String(profile.email).toLowerCase(),
      contact_number: profile.contactNumber,
      preferred_login_provider: getPreferredLoginProvider(profile.platform),
      status: "active",
      default_organization_id: organization.id,
    });

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("organization_members")
    .insert({
      organization_id: organization.id,
      user_id: userId,
      role: role || "admin",
      status: "active",
    })
    .select("organization_id, role, status")
    .single();

  if (membershipError || !membership) {
    throw new Error(membershipError?.message || "Unable to create membership");
  }

  if (competitorNames.length > 0) {
    const entityRows = competitorNames.map((name) => ({
      organization_id: organization.id,
      name,
      type: "competitor",
      aliases: [],
      keywords: [name],
      platform_links: [],
      is_competitor: true,
      watch_status: "active",
      created_by: userId,
    }));

    await supabaseAdmin.from("entities").insert(entityRows);
  }

  const defaultRuleRows = [
    {
      organization_id: organization.id,
      name: "Volume Spike > 200%",
      type: "volume_spike",
      threshold_value: 200,
      threshold_window: "24h",
      delivery_channels: ["email", "app"],
      status: "active",
      created_by: userId,
    },
    {
      organization_id: organization.id,
      name: "Negative Sentiment > 65%",
      type: "negative_sentiment",
      threshold_value: 65,
      threshold_window: "24h",
      delivery_channels: ["email", "app"],
      status: "active",
      created_by: userId,
    },
  ];

  await supabaseAdmin.from("alert_rules").insert(defaultRuleRows);

  await supabaseAdmin.from("reports").insert([
    {
      organization_id: organization.id,
      title: "Daily Media Brief",
      type: "daily",
      status: "ready",
      summary: `Daily summary for ${profile.company}.`,
      created_by: userId,
    },
  ]);

  return { organization, membership };
}

function serializeUser({ profile, organization, membership }) {
  return {
    id: profile.user_id,
    fullName: profile.full_name,
    company: organization.name,
    contactNumber: profile.contact_number || "",
    competitors: (organization.competitor_names || []).join(", "),
    email: profile.email,
    platform:
      profile.preferred_login_provider === "email"
        ? "Email"
        : profile.preferred_login_provider === "google"
          ? "Google"
          : "Microsoft",
    role: membership.role,
    organizationId: organization.id,
  };
}

async function getMembershipSnapshot(userId) {
  if (!supabaseAdmin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("user_id, full_name, email, contact_number, preferred_login_provider")
    .eq("user_id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || "Profile not found");
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (membershipError || !membership) {
    throw new Error(membershipError?.message || "Membership not found");
  }

  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .select("id, name, competitor_names")
    .eq("id", membership.organization_id)
    .single();

  if (organizationError || !organization) {
    throw new Error(organizationError?.message || "Organization not found");
  }

  return { profile, membership, organization };
}

async function getSupabaseUserFromAccessToken(accessToken) {
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    if (isSupabaseConnectivityError(error)) {
      throw new Error(getSupabaseConnectivityMessage());
    }

    throw new Error(error?.message || "Invalid Supabase session");
  }

  return data.user;
}

router.post("/signup", async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ message: MISSING_SERVICE_ROLE_MESSAGE });
    }

    const {
      fullName,
      company,
      contactNumber,
      competitors,
      role,
      email,
      password,
      platform,
    } = req.body;

    if (!fullName || !company || !contactNumber || !competitors || !email || !password) {
      return res.status(400).json({ message: "Missing required signup fields" });
    }

    const provider = String(platform || "Email").toLowerCase();
    const competitorNames = parseCompetitors(competitors);
    const emailLower = String(email).trim().toLowerCase();

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("email", emailLower)
      .maybeSingle();

    if (existingProfile) {
      return res.status(409).json({ message: "A user with this email already exists" });
    }

    const slug = await createOrganizationSlug(company);

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailLower,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError || !authUser.user) {
      return res.status(400).json({ message: authError?.message || "Unable to create auth user" });
    }

    const userId = authUser.user.id;

    const { data: organization, error: organizationError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: company,
        slug,
        competitor_names: competitorNames,
        status: "active",
        created_by: userId,
      })
      .select("id, name, competitor_names")
      .single();

    if (organizationError || !organization) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(400).json({ message: organizationError?.message || "Unable to create organization" });
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: userId,
        full_name: fullName,
        email: emailLower,
        contact_number: contactNumber,
        preferred_login_provider: getPreferredLoginProvider(provider),
        status: "active",
        default_organization_id: organization.id,
      });

    if (profileError) {
      return res.status(400).json({ message: profileError.message });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("organization_members")
      .insert({
        organization_id: organization.id,
        user_id: userId,
        role: role || "admin",
        status: "active",
      })
      .select("organization_id, role, status")
      .single();

    if (membershipError || !membership) {
      return res.status(400).json({ message: membershipError?.message || "Unable to create membership" });
    }

    if (competitorNames.length > 0) {
      const entityRows = competitorNames.map((name) => ({
        organization_id: organization.id,
        name,
        type: "competitor",
        aliases: [],
        keywords: [name],
        platform_links: [],
        is_competitor: true,
        watch_status: "active",
        created_by: userId,
      }));

      await supabaseAdmin.from("entities").insert(entityRows);
    }

    const defaultRuleRows = [
      {
        organization_id: organization.id,
        name: "Volume Spike > 200%",
        type: "volume_spike",
        threshold_value: 200,
        threshold_window: "24h",
        delivery_channels: ["email", "app"],
        status: "active",
        created_by: userId,
      },
      {
        organization_id: organization.id,
        name: "Negative Sentiment > 65%",
        type: "negative_sentiment",
        threshold_value: 65,
        threshold_window: "24h",
        delivery_channels: ["email", "app"],
        status: "active",
        created_by: userId,
      },
    ];

    await supabaseAdmin.from("alert_rules").insert(defaultRuleRows);

    await supabaseAdmin.from("reports").insert([
      {
        organization_id: organization.id,
        title: "Daily Media Brief",
        type: "daily",
        status: "ready",
        summary: `Daily summary for ${company}.`,
        created_by: userId,
      },
    ]);

    return res.status(201).json({
      user: serializeUser({
        profile: {
          user_id: userId,
          full_name: fullName,
          email: emailLower,
          contact_number: contactNumber,
          preferred_login_provider: getPreferredLoginProvider(provider),
        },
        organization,
        membership,
      }),
    });
  } catch (error) {
    if (isSupabaseConnectivityError(error)) {
      return res.status(503).json({ message: getSupabaseConnectivityMessage() });
    }

    return res.status(500).json({ message: "Signup failed", error: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.post("/oauth/exchange", async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ message: "accessToken is required" });
    }

    const user = await getSupabaseUserFromAccessToken(accessToken);

    try {
      const snapshot = await getMembershipSnapshot(user.id);
      return res.json({
        onboarded: true,
        user: serializeUser(snapshot),
      });
    } catch {
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.identities?.[0]?.identity_data?.full_name ||
        user.identities?.[0]?.identity_data?.name ||
        "";
      const provider = user.app_metadata?.provider || "email";

      return res.json({
        onboarded: false,
        oauthProfile: {
          email: user.email || "",
          fullName,
          platform: provider === "azure" ? "Microsoft" : provider === "google" ? "Google" : "Email",
        },
      });
    }
  } catch (error) {
    if (isSupabaseConnectivityError(error)) {
      return res.status(503).json({ message: getSupabaseConnectivityMessage() });
    }

    return res.status(401).json({ message: error instanceof Error ? error.message : "OAuth exchange failed" });
  }
});

router.post("/oauth/complete-signup", async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ message: MISSING_SERVICE_ROLE_MESSAGE });
    }

    const { accessToken, fullName, company, contactNumber, competitors, role, platform } = req.body;
    if (!accessToken || !fullName || !company || !contactNumber || !competitors) {
      return res.status(400).json({ message: "Missing required OAuth signup fields" });
    }

    const user = await getSupabaseUserFromAccessToken(accessToken);

    try {
      const snapshot = await getMembershipSnapshot(user.id);
      return res.json({
        user: serializeUser(snapshot),
      });
    } catch {
      const competitorNames = parseCompetitors(competitors);
      const { organization, membership } = await seedOrganizationDefaults({
        userId: user.id,
        organizationId: null,
        competitorNames,
        role,
        profile: {
          fullName,
          company,
          contactNumber,
          email: user.email || "",
          platform,
        },
      });

      return res.status(201).json({
        user: serializeUser({
          profile: {
            user_id: user.id,
            full_name: fullName,
            email: user.email || "",
            contact_number: contactNumber,
            preferred_login_provider: getPreferredLoginProvider(platform),
          },
          organization,
          membership,
        }),
      });
    }
  } catch (error) {
    if (isSupabaseConnectivityError(error)) {
      return res.status(503).json({ message: getSupabaseConnectivityMessage() });
    }

    return res.status(500).json({ message: error instanceof Error ? error.message : "OAuth signup failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: String(email).trim().toLowerCase(),
      password,
    });

    if (authError || !authData.user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    let snapshot;
    try {
      snapshot = await getMembershipSnapshot(authData.user.id);
    } catch (snapshotError) {
      if (isMissingServiceRoleError(snapshotError) || isSupabaseAdminConfigError(snapshotError)) {
        return res.status(503).json({
          message: "The backend Supabase admin credentials are invalid in Vercel. Re-save SUPABASE_SERVICE_ROLE_KEY with the full service-role key and redeploy.",
          error: getErrorMessage(snapshotError),
        });
      }

      if (isWorkspaceSnapshotIncomplete(snapshotError)) {
        return res.status(409).json({
          message: "Your account exists, but the workspace profile is incomplete. Please contact support or complete onboarding again.",
          error: getErrorMessage(snapshotError),
        });
      }

      return res.status(500).json({
        message: "Login failed while loading your workspace.",
        error: getErrorMessage(snapshotError),
      });
    }

    await supabaseAdmin
      ?.from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("user_id", authData.user.id);

    return res.json({
      user: serializeUser(snapshot),
    });
  } catch (error) {
    if (isSupabaseConnectivityError(error)) {
      return res.status(503).json({ message: getSupabaseConnectivityMessage() });
    }

    return res.status(500).json({ message: "Login failed", error: error instanceof Error ? error.message : "Unknown error" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const snapshot = await getMembershipSnapshot(req.auth.userId);
    return res.json({ user: serializeUser(snapshot) });
  } catch (error) {
    return res.status(404).json({ message: error instanceof Error ? error.message : "User not found" });
  }
});

export default router;
