import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();

function serializeMention(item) {
  return {
    _id: item.id,
    sourceId: item.source_id,
    contentType: item.content_type,
    platform: item.platform,
    sourceType: item.source_type,
    headline: item.headline,
    body: item.body,
    snippet: item.snippet,
    authorName: item.author_name,
    channelOrPublisher: item.channel_or_publisher,
    language: item.language,
    country: item.country,
    publishedAt: item.published_at,
    engagement: {
      likes: item.likes,
      comments: item.comments,
      shares: item.shares,
      views: item.views,
    },
    sentiment: {
      label: item.sentiment_label,
      score: item.sentiment_score,
    },
    riskScore: item.risk_score,
    url: item.url,
    mediaUrls: item.media_urls || [],
    tags: item.tags || [],
    rawIngestionId: item.raw_ingestion_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function serializeNarrative(item) {
  return {
    _id: item.id,
    title: item.title,
    summary: item.summary,
    keywords: item.keywords || [],
    sentiment: item.sentiment,
    trend: item.trend,
    mentionCount: item.mention_count,
    momentumScore: item.momentum_score,
    riskScore: item.risk_score,
    status: item.status,
    firstDetectedAt: item.first_detected_at,
    lastDetectedAt: item.last_detected_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function serializeAlert(item) {
  return {
    _id: item.id,
    ruleId: item.rule_id,
    severity: item.severity,
    type: item.type,
    message: item.message,
    status: item.status,
    deliveryChannels: item.delivery_channels || [],
    triggeredAt: item.triggered_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    payload: item.payload || undefined,
  };
}

router.get("/overview", requireAuth, async (req, res) => {
  const organizationId = req.auth.organizationId;

  const [
    mentionsCount,
    narrativesCount,
    openAlertsCount,
    competitorCount,
    campaignCount,
    sourceCount,
    tvSegmentsCount,
    newsArticlesCount,
    latestMentions,
    topNarratives,
    latestAlerts,
  ] = await Promise.all([
    supabaseAdmin.from("mentions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin.from("narratives").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).neq("status", "closed"),
    supabaseAdmin.from("alerts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "open"),
    supabaseAdmin.from("entities").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_competitor", true),
    supabaseAdmin.from("campaigns").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
    supabaseAdmin.from("sources").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin.from("tv_segments").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin.from("news_articles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin.from("mentions").select("*").eq("organization_id", organizationId).order("published_at", { ascending: false }).limit(6),
    supabaseAdmin.from("narratives").select("*").eq("organization_id", organizationId).order("mention_count", { ascending: false }).limit(6),
    supabaseAdmin.from("alerts").select("*").eq("organization_id", organizationId).order("triggered_at", { ascending: false }).limit(5),
  ]);

  const serializedMentions = (latestMentions.data || []).map(serializeMention);
  const serializedNarratives = (topNarratives.data || []).map(serializeNarrative);
  const serializedAlerts = (latestAlerts.data || []).map(serializeAlert);

  const topChannelsMap = new Map();
  const platformMap = new Map();
  for (const mention of serializedMentions) {
    const channel = mention.channelOrPublisher || mention.authorName || mention.platform;
    if (channel) {
      topChannelsMap.set(channel, (topChannelsMap.get(channel) || 0) + 1);
    }
    if (mention.platform) {
      platformMap.set(mention.platform, (platformMap.get(mention.platform) || 0) + 1);
    }
  }

  const positive = serializedMentions.filter((item) => item.sentiment.label === "positive").length;
  const neutral = serializedMentions.filter((item) => item.sentiment.label === "neutral").length;
  const negative = serializedMentions.filter((item) => item.sentiment.label === "negative").length;

  return res.json({
    metrics: {
      mentionCount: mentionsCount.count || 0,
      narrativeCount: narrativesCount.count || 0,
      openAlerts: openAlertsCount.count || 0,
      competitorCount: competitorCount.count || 0,
      campaignCount: campaignCount.count || 0,
      sourceCount: sourceCount.count || 0,
      tvSegmentCount: tvSegmentsCount.count || 0,
      newsArticleCount: newsArticlesCount.count || 0,
    },
    latestMentions: serializedMentions,
    topNarratives: serializedNarratives,
    latestAlerts: serializedAlerts,
    topChannels: Array.from(topChannelsMap.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    platformMix: Array.from(platformMap.entries())
      .map(([platform, value]) => ({ platform, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
    sentimentDistribution: [
      { label: "Positive", value: positive },
      { label: "Neutral", value: neutral },
      { label: "Negative", value: negative },
    ],
  });
});

export default router;
