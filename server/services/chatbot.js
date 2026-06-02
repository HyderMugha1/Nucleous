import { supabaseAdmin } from "../supabase.js";

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function detectIntent(message) {
  const normalized = message.toLowerCase();
  if (normalized.includes("why")) return "why";
  if (normalized.includes("competitor")) return "competitor";
  if (normalized.includes("influencer")) return "influencer";
  if (normalized.includes("alert")) return "alert";
  if (normalized.includes("narrative")) return "narrative";
  if (normalized.includes("report") || normalized.includes("brief")) return "report";
  if (normalized.includes("sentiment")) return "sentiment";
  if (normalized.includes("mention")) return "mention";
  if (normalized.includes("what changed") || normalized.includes("changed")) return "changes";
  return "general";
}

async function getDashboardSnapshot(organizationId) {
  const [mentionCount, openAlerts, topMention, topNarrative, latestAlerts, latestMentions] = await Promise.all([
    supabaseAdmin.from("mentions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin.from("alerts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "open"),
    supabaseAdmin.from("mentions").select("*").eq("organization_id", organizationId).order("views", { ascending: false }).order("published_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("narratives").select("*").eq("organization_id", organizationId).order("momentum_score", { ascending: false }).order("mention_count", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("alerts").select("*").eq("organization_id", organizationId).eq("status", "open").order("triggered_at", { ascending: false }).limit(3),
    supabaseAdmin.from("mentions").select("*").eq("organization_id", organizationId).order("published_at", { ascending: false }).limit(3),
  ]);

  return {
    mentionCount: mentionCount.count || 0,
    openAlerts: openAlerts.count || 0,
    topMention: topMention.data || null,
    topNarrative: topNarrative.data || null,
    latestAlerts: latestAlerts.data || [],
    latestMentions: latestMentions.data || [],
  };
}

async function getReportSnapshot(organizationId) {
  const [latestReport, readyReports, activeCampaign, topInfluencer, topNarrative, mentionCount] = await Promise.all([
    supabaseAdmin.from("reports").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("reports").select("*").eq("organization_id", organizationId).in("status", ["ready", "generated"]).order("created_at", { ascending: false }).limit(4),
    supabaseAdmin.from("campaigns").select("*").eq("organization_id", organizationId).eq("status", "active").order("start_date", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("influencers").select("*").eq("organization_id", organizationId).order("reach", { ascending: false }).order("engagement", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("narratives").select("*").eq("organization_id", organizationId).order("mention_count", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("mentions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
  ]);

  return {
    latestReport: latestReport.data || null,
    readyReports: readyReports.data || [],
    activeCampaign: activeCampaign.data || null,
    topInfluencer: topInfluencer.data || null,
    topNarrative: topNarrative.data || null,
    mentionCount: mentionCount.count || 0,
  };
}

export async function generateModuleSummary({ organizationId, contextType }) {
  if (contextType === "report") {
    const snapshot = await getReportSnapshot(organizationId);
    const reportTitle = snapshot.latestReport?.title || "the latest reporting cycle";
    const influencer = snapshot.topInfluencer?.name || "top creators";
    const narrative = snapshot.topNarrative?.title || "your leading narrative";

    return `Reporting is anchored by ${reportTitle}, with ${formatCount(snapshot.mentionCount)} tracked mentions in scope. ${narrative} remains the strongest narrative, and ${influencer} is currently the highest-reach influencer signal for briefing material.`;
  }

  const snapshot = await getDashboardSnapshot(organizationId);
  const sentiment = snapshot.topMention?.sentiment_label || "mixed";
  const narrativeSummary = snapshot.topNarrative?.title
    ? `${snapshot.topNarrative.title} is currently the strongest narrative`
    : "There is no dominant narrative yet";

  return `The command center is tracking ${formatCount(snapshot.mentionCount)} mentions with ${snapshot.openAlerts} open alerts. ${narrativeSummary}, and the most amplified recent conversation is leaning ${sentiment}.`;
}

function buildWhyAnswer(snapshot) {
  const topNarrative = snapshot.topNarrative?.title || "the leading narrative";
  const topMention = snapshot.topMention?.headline || "the latest high-engagement mention";
  return `The spike is being driven by ${topNarrative}, with attention concentrated around "${topMention}". The pattern suggests high engagement plus repeated coverage across multiple sources, which is why volume and risk are climbing together.`;
}

function buildDashboardAnswer(intent, snapshot) {
  switch (intent) {
    case "alert":
      return snapshot.latestAlerts.length > 0
        ? `There are ${snapshot.openAlerts} open alerts right now. The most recent one is "${snapshot.latestAlerts[0].message}", so the immediate priority is to review that trigger and confirm whether a response or escalation is needed.`
        : "There are no open alerts right now, so the platform is not showing an immediate escalation condition.";
    case "narrative":
      return snapshot.topNarrative
        ? `${snapshot.topNarrative.title} is the strongest live narrative with ${formatCount(snapshot.topNarrative.mention_count)} mentions, ${snapshot.topNarrative.trend} momentum, and ${snapshot.topNarrative.sentiment} sentiment.`
        : "There is no active narrative data yet for this workspace.";
    case "sentiment":
      return snapshot.topMention
        ? `Recent amplified coverage is leaning ${snapshot.topMention.sentiment_label}, and the latest high-impact mention is "${snapshot.topMention.headline}". That means tone management should focus on the current top conversation cluster first.`
        : "There is not enough recent mention data yet to describe sentiment reliably.";
    case "mention":
    case "changes":
      return snapshot.latestMentions.length > 0
        ? `The latest changes are concentrated in ${snapshot.latestMentions.map((item) => item.platform).filter(Boolean).slice(0, 3).join(", ")}. The newest mention is "${snapshot.latestMentions[0].headline}", which is a good starting point for drill-down.`
        : "No recent mention changes are available yet.";
    case "why":
      return buildWhyAnswer(snapshot);
    default:
      return `Right now the workspace has ${formatCount(snapshot.mentionCount)} mentions, ${snapshot.openAlerts} open alerts, and ${snapshot.topNarrative?.title || "no dominant narrative yet"} as the main conversation driver.`;
  }
}

function buildReportAnswer(intent, snapshot) {
  switch (intent) {
    case "report":
      return snapshot.latestReport
        ? `The latest report is "${snapshot.latestReport.title}" and it is currently ${snapshot.latestReport.status}. You also have ${snapshot.readyReports.length} ready or generated reports available for export.`
        : "There is no generated report yet, but the reporting workspace is ready to produce one.";
    case "competitor":
      return snapshot.topNarrative
        ? `Competitor movement is best framed through ${snapshot.topNarrative.title}, which is currently the highest-volume narrative. I'd position that as the lead section in the report.`
        : "There is not enough competitor-linked narrative data yet to build a strong comparison section.";
    case "influencer":
      return snapshot.topInfluencer
        ? `${snapshot.topInfluencer.name} is the highest-reach influencer in the current workspace at ${formatCount(snapshot.topInfluencer.reach)} reach and ${snapshot.topInfluencer.engagement}% engagement.`
        : "No influencer profile is available yet for a report-ready ranking.";
    case "sentiment":
      return snapshot.topNarrative
        ? `${snapshot.topNarrative.title} is the strongest report anchor right now and it currently leans ${snapshot.topNarrative.sentiment}, which should shape the tone of the executive summary.`
        : "There is not enough narrative data yet to generate a sentiment-led report summary.";
    case "why":
      return snapshot.activeCampaign
        ? `The reporting spike is most likely tied to ${snapshot.activeCampaign.name}, because that is the active campaign linked to the current reporting cycle and surrounding mentions.`
        : "The current reporting movement appears to be driven by narrative and mention activity rather than a clearly active campaign.";
    default:
      return `Your reporting workspace currently has ${formatCount(snapshot.mentionCount)} mentions in scope, ${snapshot.readyReports.length} ready reports, and ${snapshot.topNarrative?.title || "no dominant narrative yet"} as the best lead topic.`;
  }
}

export async function generateAssistantReply({ organizationId, contextType, message }) {
  const intent = detectIntent(message);
  if (contextType === "report") {
    const snapshot = await getReportSnapshot(organizationId);
    return buildReportAnswer(intent, snapshot);
  }
  const snapshot = await getDashboardSnapshot(organizationId);
  return buildDashboardAnswer(intent, snapshot);
}

export async function getLatestConversation({ organizationId, userId, contextType }) {
  const { data: conversation } = await supabaseAdmin
    .from("ai_conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("context_type", contextType)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) return null;

  const { data: messages } = await supabaseAdmin
    .from("ai_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  return {
    _id: conversation.id,
    contextType: conversation.context_type,
    contextRefId: conversation.context_ref_id,
    messages: (messages || []).map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
    })),
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
  };
}

export async function respondInConversation({
  organizationId,
  userId,
  contextType,
  contextRefId,
  conversationId,
  message,
}) {
  const assistantReply = await generateAssistantReply({
    organizationId,
    contextType,
    message,
  });

  let conversation = null;
  if (conversationId) {
    const response = await supabaseAdmin
      .from("ai_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("context_type", contextType)
      .maybeSingle();
    conversation = response.data || null;
  }

  if (!conversation) {
    const response = await supabaseAdmin
      .from("ai_conversations")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        context_type: contextType,
        context_ref_id: contextRefId || null,
      })
      .select("*")
      .single();
    conversation = response.data;
  }

  await supabaseAdmin.from("ai_messages").insert([
    {
      organization_id: organizationId,
      conversation_id: conversation.id,
      role: "user",
      content: message,
    },
    {
      organization_id: organizationId,
      conversation_id: conversation.id,
      role: "assistant",
      content: assistantReply,
    },
  ]);

  const latest = await getLatestConversation({
    organizationId,
    userId,
    contextType,
  });

  return {
    conversation: latest,
    reply: assistantReply,
  };
}
