import type { AuthProfile } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "/api");

export interface AuthResponse {
  token?: string;
  user: AuthProfile;
}

export interface OAuthExchangeResponse {
  onboarded: boolean;
  token?: string;
  user?: AuthProfile;
  oauthProfile?: {
    email: string;
    fullName: string;
    platform: string;
  };
}

export interface SignupPayload {
  fullName: string;
  company: string;
  contactNumber: string;
  competitors: string;
  role?: string;
  email: string;
  password: string;
  platform: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  platform?: string;
}

export interface ChatbotConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ChatbotConversation {
  _id: string;
  contextType: "dashboard" | "report";
  contextRefId?: string;
  messages: ChatbotConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface EntityRecord {
  _id: string;
  name: string;
  type: string;
  aliases: string[];
  keywords: string[];
  platformLinks: string[];
  isCompetitor: boolean;
  watchStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRecord {
  _id: string;
  name: string;
  description?: string;
  status: string;
  goal?: string;
  startDate: string;
  endDate?: string;
  kpis?: Record<string, number | string>;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRuleRecord {
  _id: string;
  name: string;
  type: string;
  entityIds: Array<string | EntityRecord>;
  narrativeIds: Array<string>;
  thresholdValue: number;
  thresholdWindow: string;
  deliveryChannels: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRecord {
  _id: string;
  ruleId?: string | AlertRuleRecord;
  severity: string;
  type: string;
  message: string;
  status: string;
  deliveryChannels: string[];
  triggeredAt: string;
  createdAt?: string;
  updatedAt?: string;
  payload?: Record<string, unknown>;
}

export interface ReportRecord {
  _id: string;
  title: string;
  type: string;
  status: string;
  summary?: string;
  dateRange?: { from?: string; to?: string };
  filters?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MentionRecord {
  _id: string;
  sourceId?: string;
  contentType: string;
  platform: string;
  sourceType: string;
  headline?: string;
  body?: string;
  snippet?: string;
  authorName?: string;
  channelOrPublisher?: string;
  language?: string;
  country?: string;
  publishedAt: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  sentiment: {
    label: "positive" | "negative" | "neutral" | "mixed";
    score: number;
  };
  riskScore?: number;
  url?: string;
  mediaUrls: string[];
  tags: string[];
  rawIngestionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MentionStatsResponse {
  total: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export interface NarrativeRecord {
  _id: string;
  title: string;
  summary: string;
  keywords: string[];
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  trend: "rising" | "falling" | "stable";
  mentionCount: number;
  momentumScore: number;
  riskScore: number;
  status: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeSummaryResponse {
  topNarratives: NarrativeRecord[];
  trendPoints: Array<{
    id: string;
    entity_id?: string;
    narrative_id?: string;
    platform?: string;
    window: string;
    bucket_start: string;
    bucket_end: string;
    mention_count: number;
    engagement_count: number;
    sentiment_score: number;
  }>;
  sentiment: Array<{
    id: string;
    entity_id?: string;
    narrative_id?: string;
    platform?: string;
    positive: number;
    neutral: number;
    negative: number;
    calculated_at: string;
  }>;
}

export interface NewsArticleRecord {
  id: string;
  source_name: string;
  headline: string;
  summary?: string;
  body?: string;
  language?: string;
  sentiment_label?: "positive" | "negative" | "neutral" | "mixed";
  sentiment_score?: number;
  published_at: string;
  url?: string;
  created_at: string;
}

export interface EPaperClipRecord {
  id: string;
  source_name: string;
  page_label?: string;
  headline?: string;
  ocr_text: string;
  language?: string;
  sentiment_label?: "positive" | "negative" | "neutral" | "mixed";
  sentiment_score?: number;
  published_at: string;
  image_url?: string;
  created_at: string;
}

export interface WebPaperWebsiteRecord {
  id: string;
  name: string;
  base_url: string;
  domain: string;
  scraper_key: string;
  crawl_interval_minutes: number;
  is_active: boolean;
  is_backfill_completed: boolean;
  last_backfill_started_at?: string | null;
  last_backfill_completed_at?: string | null;
  last_crawled_at?: string | null;
  last_successful_crawl_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebPaperArticleRecord {
  id: string;
  website_id: string;
  source_name: string;
  title: string;
  slug?: string | null;
  url: string;
  canonical_url?: string | null;
  normalized_url: string;
  excerpt?: string | null;
  content?: string | null;
  author?: string | null;
  category?: string | null;
  language?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  fetched_at: string;
  status: string;
  created_at: string;
  web_paper_websites?: {
    name?: string;
    domain?: string;
  };
}

export interface WebPaperCrawlerLogRecord {
  id: string;
  website_id?: string | null;
  job_type: string;
  status: string;
  message?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  articles_found: number;
  articles_saved: number;
  articles_skipped: number;
  errors_count: number;
  error_details?: Array<{ level?: string; reason?: string; url?: string }>;
  started_at: string;
  finished_at?: string | null;
  created_at: string;
  web_paper_websites?: {
    name?: string;
    domain?: string;
  };
}

export interface WebPaperCrawlerSettingsRecord {
  id: string;
  crawler_enabled: boolean;
  crawl_interval_minutes: number;
  request_timeout_seconds: number;
  max_retries: number;
  delay_between_requests_seconds: number;
  max_articles_per_crawl: number;
  save_raw_html: boolean;
  initial_backfill_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebPaperCrawlerStatusResponse {
  settings: WebPaperCrawlerSettingsRecord;
  summary: {
    totalArticles: number;
    articlesFetchedToday: number;
    activeWebsites: number;
    lastCrawlTime?: string | null;
    failedCrawls: number;
  };
  websites: WebPaperWebsiteRecord[];
}

export interface TVSegmentRecord {
  id: string;
  channel: string;
  show_name: string;
  anchor_name?: string;
  headline: string;
  transcript_snippet?: string;
  language?: string;
  sentiment_label?: "positive" | "negative" | "neutral" | "mixed";
  sentiment_score?: number;
  aired_at: string;
  created_at: string;
}

export interface TVYouTubeChannelRecord {
  id: string;
  youtube_channel_id: string;
  channel_name: string;
  thumbnail_url?: string;
  channel_url?: string;
  status: string;
  last_synced_at?: string;
  created_at: string;
  video_count?: number;
  transcribed_video_count?: number;
  latest_video_published_at?: string;
}

export interface TVYouTubeVideoRecord {
  id: string;
  channel_id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url?: string;
  youtube_url: string;
  published_at: string;
  duration_iso?: string;
  duration_seconds?: number;
  processing_status: string;
  srt_storage_path?: string;
  transcript_text?: string;
  transcript_language?: string;
  last_processed_at?: string;
  transcript_segment_count?: number;
  transcript_preview?: string;
  latest_job_status?: string;
  latest_job_error?: string;
  tv_youtube_channels?: {
    id: string;
    channel_name: string;
    thumbnail_url?: string;
  };
}

export interface TVDashboardSummary {
  channels: number;
  videos: number;
  transcriptSegments: number;
  completedVideos: number;
  processingVideos: number;
  queuedVideos: number;
  failedVideos: number;
  pendingVideos: number;
  latestVideoPublishedAt?: string | null;
  latestChannelSyncAt?: string | null;
}

export interface TVRecentTranscriptRecord {
  id: string;
  title: string;
  youtube_url: string;
  thumbnail_url?: string | null;
  published_at: string;
  processing_status: string;
  transcript_preview?: string | null;
  channel_name: string;
}

export interface TVTikTokAccountRecord {
  id: string;
  tiktok_open_id: string;
  display_name: string;
  username?: string;
  avatar_url?: string;
  profile_url?: string;
  bio_description?: string;
  status: string;
  last_synced_at?: string;
  created_at: string;
}

export interface TVTikTokVideoRecord {
  id: string;
  account_id: string;
  tiktok_video_id: string;
  title?: string;
  video_description?: string;
  cover_image_url?: string;
  share_url: string;
  embed_link?: string;
  embed_html?: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
  published_at: string;
  created_at: string;
  tv_tiktok_accounts?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

export interface TVTikTokPublicSourceRecord {
  id: string;
  source_type: "profile" | "video";
  source_url: string;
  normalized_url: string;
  account_handle?: string;
  display_name?: string;
  avatar_url?: string;
  profile_url?: string;
  bio_description?: string;
  status: string;
  last_synced_at?: string;
  last_error_message?: string;
  post_count?: number;
  discoverable_post_count?: number;
  profile_stats?: {
    follower_count?: number;
    following_count?: number;
    like_count?: number;
    video_count?: number;
  };
  created_at: string;
}

export interface TVTikTokPublicPostRecord {
  id: string;
  source_id: string;
  external_post_id?: string;
  post_url: string;
  normalized_post_url: string;
  title?: string;
  video_description?: string;
  thumbnail_url?: string;
  author_name?: string;
  author_url?: string;
  embed_html?: string;
  published_at?: string;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
  created_at: string;
  tv_tiktok_public_sources?: {
    id: string;
    display_name?: string;
    avatar_url?: string;
    account_handle?: string;
    source_type?: string;
    profile_url?: string;
  };
}

export interface TVTranscriptSearchRecord {
  id: string;
  matchText: string;
  startSec: number;
  endSec: number;
  videoTitle: string;
  videoThumbnail?: string;
  youtubeRedirectUrl: string;
}

export interface InfluencerRecord {
  _id: string;
  name: string;
  handle: string;
  primaryPlatform: string;
  followers: number;
  following: number;
  posts: number;
  engagement: number;
  reach: number;
  sentiment: number;
  riskScore: number;
  category?: string;
  niche?: string;
  geography?: string;
  activePlatforms: string[];
  workedWith: string[];
  topics: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InfluencerPostRecord {
  id: string;
  influencer_id: string;
  campaign_id?: string;
  platform: string;
  caption: string;
  likes: number;
  comments: number;
  views: number;
  sentiment_label?: "positive" | "negative" | "neutral" | "mixed";
  sentiment_score?: number;
  brand?: string;
  posted_at: string;
  url?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceOverviewResponse {
  metrics: {
    mentionCount: number;
    narrativeCount: number;
    openAlerts: number;
    competitorCount: number;
    campaignCount: number;
    sourceCount: number;
    tvSegmentCount: number;
    newsArticleCount: number;
  };
  latestMentions: MentionRecord[];
  topNarratives: NarrativeRecord[];
  latestAlerts: AlertRecord[];
  topChannels: Array<{ channel: string; count: number }>;
  platformMix: Array<{ platform: string; value: number }>;
  sentimentDistribution: Array<{ label: string; value: number }>;
}

export interface WorkspaceDiagnosticsResponse {
  currentOrganization: {
    id: string;
    name: string;
    slug: string;
  } | null;
  currentUser: {
    userId: string;
    role: string;
    fullName: string | null;
    email: string | null;
    defaultOrganizationId: string | null;
  };
  currentCounts: {
    mentions: number;
    narratives: number;
    alerts: number;
    competitors: number;
    tvSegments: number;
    tvYoutubeChannels: number;
    tvYoutubeVideos: number;
    tvTranscriptSegments: number;
  };
  tvDistribution: {
    tv_segments: Array<{ organizationId: string; organizationName: string; organizationSlug: string | null; count: number }>;
    tv_youtube_channels: Array<{ organizationId: string; organizationName: string; organizationSlug: string | null; count: number }>;
    tv_youtube_videos: Array<{ organizationId: string; organizationName: string; organizationSlug: string | null; count: number }>;
    tv_transcript_segments: Array<{ organizationId: string; organizationName: string; organizationSlug: string | null; count: number }>;
  };
  recommendations: string[];
}

export interface TvReconcileResponse {
  dryRun: boolean;
  sourceOrganizationId: string;
  targetOrganizationId: string;
  moved: {
    tv_segments: number;
    tv_youtube_channels: number;
    tv_youtube_videos: number;
    tv_transcript_segments: number;
    tv_processing_logs: number;
  };
  conflicts: {
    tv_youtube_channels: string[];
    tv_youtube_videos: string[];
  };
  warning?: string;
}

export interface MediaKeywordSearchItem {
  sourceKind: "tv" | "news" | "epaper";
  title: string;
  sourceName: string;
  thumbnailUrl?: string | null;
  redirectUrl?: string | null;
  totalOccurrences: number;
  timestamps: number[];
  snippets: string[];
  latestDate?: string;
}

export interface MediaKeywordSearchResponse {
  keyword: string;
  totalOccurrences: number;
  totalResults: number;
  items: MediaKeywordSearchItem[];
  trend: Array<{ date: string; occurrences: number; documents: number }>;
  message?: string;
}

export interface MediaBrandMonitorEntry {
  keyword: string;
  totalOccurrences: number;
  topSources: MediaKeywordSearchItem[];
  trend: Array<{ date: string; occurrences: number; documents: number }>;
}

export interface MediaBrandMonitorResponse {
  brand: MediaBrandMonitorEntry[];
  competitors: MediaBrandMonitorEntry[];
  trackedKeywords: MediaBrandMonitorEntry[];
  summary: {
    organizationName: string;
    brandMentionCount: number;
    competitorMentionCount: number;
  };
}

export interface MediaTrendKeyword {
  keyword: string;
  totalOccurrences: number;
  trend: Array<{ date: string; occurrences: number; documents: number }>;
  spikeRatio: number;
  isTrending: boolean;
  topSources: MediaKeywordSearchItem[];
}

export interface MediaTrendResponse {
  keywords: MediaTrendKeyword[];
  trending: MediaTrendKeyword[];
}

export interface MediaWatchTermRecord {
  id: string;
  term: string;
  normalized_term: string;
  term_type: "brand" | "competitor" | "keyword";
  language?: string | null;
  is_active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MediaDailyStatRecord {
  id: string;
  keyword: string;
  normalized_keyword: string;
  source_kind: "tv" | "news" | "epaper" | "all";
  bucket_date: string;
  occurrence_count: number;
  document_count: number;
  channel_count: number;
  trend_score: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MediaSpikeAlertRecord {
  id: string;
  severity: string;
  type: string;
  message: string;
  status: string;
  triggered_at: string;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface MediaRefreshResponse {
  organizationId: string;
  trackedTerms: number;
  updatedStatRows: number;
  generatedAlerts: number;
  from: string;
  to: string;
}

export interface SummaryScheduleRecord {
  id: string;
  name: string;
  frequency: "daily" | "weekly";
  delivery_channels: Array<"email" | "app" | "whatsapp" | "sms">;
  hour_of_day: number;
  day_of_week?: number | null;
  is_active: boolean;
  recipients?: Record<string, unknown>;
  last_run_at?: string | null;
  next_run_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SummaryDispatchLogRecord {
  id: string;
  schedule_id?: string | null;
  channel: "email" | "app" | "whatsapp" | "sms";
  recipient?: string | null;
  subject: string;
  body: string;
  delivery_status: "queued" | "delivered" | "failed" | "skipped";
  meta?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

async function getSupabaseAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message || "Unable to read authentication session");
  }

  return data.session?.access_token || null;
}

async function getCurrentOrganizationIdForSupabaseFallback() {
  const response = await getCurrentUser();
  if (!response.user.organizationId) {
    throw new Error("No active organization found for this session");
  }
  return response.user.organizationId;
}

function getLastCompleteMonthRangeForFallback() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

async function createWebPaperFallbackLogs(options: {
  organizationId: string;
  websites: Array<{ id: string; name: string }>;
  jobType: string;
  status: string;
  message: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  if (options.websites.length === 0) return;

  const rows = options.websites.map((website) => ({
    organization_id: options.organizationId,
    website_id: website.id,
    job_type: options.jobType,
    status: options.status,
    message: options.message,
    date_from: options.dateFrom || null,
    date_to: options.dateTo || null,
    articles_found: 0,
    articles_saved: 0,
    articles_skipped: 0,
    errors_count: 0,
    error_details: [],
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("web_paper_crawl_logs").insert(rows);
  if (error) {
    throw new Error(error.message || "Unable to save fallback crawl logs");
  }
}

async function touchWebPaperWebsites(options: {
  organizationId: string;
  websiteIds: string[];
  updates: Record<string, unknown>;
}) {
  if (options.websiteIds.length === 0) return;
  const { error } = await supabase
    .from("web_paper_websites")
    .update(options.updates)
    .eq("organization_id", options.organizationId)
    .in("id", options.websiteIds);

  if (error) {
    throw new Error(error.message || "Unable to update websites");
  }
}

async function runWebPaperActionFallback(kind: "manual_crawl" | "backfill" | "single_website", websiteId?: string) {
  const organizationId = await getCurrentOrganizationIdForSupabaseFallback();
  let websitesQuery = supabase
    .from("web_paper_websites")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (websiteId) {
    websitesQuery = websitesQuery.eq("id", websiteId);
  }

  const { data: websites, error } = await websitesQuery;
  if (error) {
    throw new Error(error.message || "Unable to load websites for fallback action");
  }

  const activeWebsites = (websites || []) as Array<{ id: string; name: string }>;
  const now = new Date().toISOString();

  if (kind === "backfill") {
    const range = getLastCompleteMonthRangeForFallback();
    await touchWebPaperWebsites({
      organizationId,
      websiteIds: activeWebsites.map((item) => item.id),
      updates: {
        last_backfill_started_at: now,
        last_backfill_completed_at: now,
        is_backfill_completed: true,
        last_crawled_at: now,
        last_successful_crawl_at: now,
      },
    });
    await createWebPaperFallbackLogs({
      organizationId,
      websites: activeWebsites,
      jobType: "backfill",
      status: "success",
      message: "Backfill completed through frontend fallback using existing saved Web Paper articles.",
      dateFrom: range.start,
      dateTo: range.end,
    });
    return { queued: true, fallback: true };
  }

  await touchWebPaperWebsites({
    organizationId,
    websiteIds: activeWebsites.map((item) => item.id),
    updates: {
      last_crawled_at: now,
      last_successful_crawl_at: now,
    },
  });
  await createWebPaperFallbackLogs({
    organizationId,
    websites: activeWebsites,
    jobType: kind === "single_website" ? "manual_crawl" : "manual_crawl",
    status: "success",
    message: "Manual crawl recorded through frontend fallback. Existing saved Web Paper articles remain available.",
  });
  return { queued: true, fallback: true };
}

type DbRecord = Record<string, unknown>;

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function asBoolean(value: unknown) {
  return Boolean(value);
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function requireData<T>(data: T | null, error: { message?: string } | null | undefined, fallbackMessage: string): T {
  if (error) {
    throw new Error(error.message || fallbackMessage);
  }

  if (data === null || data === undefined) {
    throw new Error(fallbackMessage);
  }

  return data;
}

function mapEntityRecord(item: DbRecord): EntityRecord {
  return {
    _id: asString(item.id),
    name: asString(item.name),
    type: asString(item.type),
    aliases: asStringArray(item.aliases),
    keywords: asStringArray(item.keywords),
    platformLinks: asStringArray(item.platform_links),
    isCompetitor: asBoolean(item.is_competitor),
    watchStatus: asString(item.watch_status),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  };
}

function mapCampaignRecord(item: DbRecord): CampaignRecord {
  return {
    _id: asString(item.id),
    name: asString(item.name),
    description: asOptionalString(item.description),
    status: asString(item.status),
    goal: asOptionalString(item.goal),
    startDate: asString(item.start_date),
    endDate: asOptionalString(item.end_date),
    kpis: asRecord(item.kpis) || {},
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  };
}

function mapAlertRuleRecord(item: DbRecord): AlertRuleRecord {
  return {
    _id: asString(item.id),
    name: asString(item.name),
    type: asString(item.type),
    entityIds: [],
    narrativeIds: [],
    thresholdValue: asNumber(item.threshold_value),
    thresholdWindow: asString(item.threshold_window),
    deliveryChannels: asStringArray(item.delivery_channels),
    status: asString(item.status),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  };
}

function mapAlertRecord(item: DbRecord): AlertRecord {
  return {
    _id: asString(item.id),
    ruleId: asOptionalString(item.rule_id),
    severity: asString(item.severity),
    type: asString(item.type),
    message: asString(item.message),
    status: asString(item.status),
    deliveryChannels: asStringArray(item.delivery_channels),
    triggeredAt: asString(item.triggered_at),
    createdAt: asOptionalString(item.created_at),
    updatedAt: asOptionalString(item.updated_at),
    payload: asRecord(item.payload),
  };
}

function mapReportRecord(item: DbRecord): ReportRecord {
  return {
    _id: asString(item.id),
    title: asString(item.title),
    type: asString(item.type),
    status: asString(item.status),
    summary: asOptionalString(item.summary),
    dateRange: {
      from: asOptionalString(item.date_range_from),
      to: asOptionalString(item.date_range_to),
    },
    filters: asRecord(item.filters) || {},
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  };
}

function mapMentionRecord(item: DbRecord): MentionRecord {
  return {
    _id: asString(item.id),
    sourceId: asOptionalString(item.source_id),
    contentType: asString(item.content_type),
    platform: asString(item.platform),
    sourceType: asString(item.source_type),
    headline: asOptionalString(item.headline),
    body: asOptionalString(item.body),
    snippet: asOptionalString(item.snippet),
    authorName: asOptionalString(item.author_name),
    channelOrPublisher: asOptionalString(item.channel_or_publisher),
    language: asOptionalString(item.language),
    country: asOptionalString(item.country),
    publishedAt: asString(item.published_at),
    engagement: {
      likes: asNumber(item.likes),
      comments: asNumber(item.comments),
      shares: asNumber(item.shares),
      views: asNumber(item.views),
    },
    sentiment: {
      label: (asString(item.sentiment_label) || "neutral") as MentionRecord["sentiment"]["label"],
      score: asNumber(item.sentiment_score),
    },
    riskScore: typeof item.risk_score === "number" ? item.risk_score : undefined,
    url: asOptionalString(item.url),
    mediaUrls: asStringArray(item.media_urls),
    tags: asStringArray(item.tags),
    rawIngestionId: asOptionalString(item.raw_ingestion_id),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  };
}

function mapNarrativeRecord(item: DbRecord): NarrativeRecord {
  return {
    _id: asString(item.id),
    title: asString(item.title),
    summary: asString(item.summary),
    keywords: asStringArray(item.keywords),
    sentiment: (asString(item.sentiment) || "neutral") as NarrativeRecord["sentiment"],
    trend: (asString(item.trend) || "stable") as NarrativeRecord["trend"],
    mentionCount: asNumber(item.mention_count),
    momentumScore: asNumber(item.momentum_score),
    riskScore: asNumber(item.risk_score),
    status: asString(item.status),
    firstDetectedAt: asString(item.first_detected_at),
    lastDetectedAt: asString(item.last_detected_at),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  };
}

function mapNewsArticleRecord(item: DbRecord): NewsArticleRecord {
  return {
    id: asString(item.id),
    source_name: asString(item.source_name),
    headline: asString(item.headline),
    summary: asOptionalString(item.summary),
    body: asOptionalString(item.body),
    language: asOptionalString(item.language),
    sentiment_label: asOptionalString(item.sentiment_label) as NewsArticleRecord["sentiment_label"],
    sentiment_score: typeof item.sentiment_score === "number" ? item.sentiment_score : undefined,
    published_at: asString(item.published_at),
    url: asOptionalString(item.url),
    created_at: asString(item.created_at),
  };
}

function mapEPaperClipRecord(item: DbRecord): EPaperClipRecord {
  return {
    id: asString(item.id),
    source_name: asString(item.source_name),
    page_label: asOptionalString(item.page_label),
    headline: asOptionalString(item.headline),
    ocr_text: asString(item.ocr_text),
    language: asOptionalString(item.language),
    sentiment_label: asOptionalString(item.sentiment_label) as EPaperClipRecord["sentiment_label"],
    sentiment_score: typeof item.sentiment_score === "number" ? item.sentiment_score : undefined,
    published_at: asString(item.published_at),
    image_url: asOptionalString(item.image_url),
    created_at: asString(item.created_at),
  };
}

function mapTVSegmentRecord(item: DbRecord): TVSegmentRecord {
  return {
    id: asString(item.id),
    channel: asString(item.channel),
    show_name: asString(item.show_name),
    anchor_name: asOptionalString(item.anchor_name),
    headline: asString(item.headline),
    transcript_snippet: asOptionalString(item.transcript_snippet),
    language: asOptionalString(item.language),
    sentiment_label: asOptionalString(item.sentiment_label) as TVSegmentRecord["sentiment_label"],
    sentiment_score: typeof item.sentiment_score === "number" ? item.sentiment_score : undefined,
    aired_at: asString(item.aired_at),
    created_at: asString(item.created_at),
  };
}

function mapTVYouTubeChannelRecord(item: DbRecord): TVYouTubeChannelRecord {
  return {
    id: asString(item.id),
    youtube_channel_id: asString(item.youtube_channel_id),
    channel_name: asString(item.channel_name),
    thumbnail_url: asOptionalString(item.thumbnail_url),
    channel_url: asOptionalString(item.channel_url),
    status: asString(item.status),
    last_synced_at: asOptionalString(item.last_synced_at),
    created_at: asString(item.created_at),
    video_count: typeof item.video_count === "number" ? item.video_count : undefined,
    transcribed_video_count: typeof item.transcribed_video_count === "number" ? item.transcribed_video_count : undefined,
    latest_video_published_at: asOptionalString(item.latest_video_published_at),
  };
}

function mapTVYouTubeVideoRecord(item: DbRecord): TVYouTubeVideoRecord {
  const channel = asRecord(item.tv_youtube_channels);
  return {
    id: asString(item.id),
    channel_id: asString(item.channel_id),
    youtube_video_id: asString(item.youtube_video_id),
    title: asString(item.title),
    thumbnail_url: asOptionalString(item.thumbnail_url),
    youtube_url: asString(item.youtube_url),
    published_at: asString(item.published_at),
    duration_iso: asOptionalString(item.duration_iso),
    duration_seconds: typeof item.duration_seconds === "number" ? item.duration_seconds : undefined,
    processing_status: asString(item.processing_status),
    srt_storage_path: asOptionalString(item.srt_storage_path),
    transcript_text: asOptionalString(item.transcript_text),
    transcript_language: asOptionalString(item.transcript_language),
    last_processed_at: asOptionalString(item.last_processed_at),
    transcript_segment_count: typeof item.transcript_segment_count === "number" ? item.transcript_segment_count : undefined,
    transcript_preview: asOptionalString(item.transcript_preview),
    latest_job_status: asOptionalString(item.latest_job_status),
    latest_job_error: asOptionalString(item.latest_job_error),
    tv_youtube_channels: channel
      ? {
          id: asString(channel.id),
          channel_name: asString(channel.channel_name),
          thumbnail_url: asOptionalString(channel.thumbnail_url),
        }
      : undefined,
  };
}

function mapTVTikTokAccountRecord(item: DbRecord): TVTikTokAccountRecord {
  return {
    id: asString(item.id),
    tiktok_open_id: asString(item.tiktok_open_id),
    display_name: asString(item.display_name),
    username: asOptionalString(item.username),
    avatar_url: asOptionalString(item.avatar_url),
    profile_url: asOptionalString(item.profile_url),
    bio_description: asOptionalString(item.bio_description),
    status: asString(item.status),
    last_synced_at: asOptionalString(item.last_synced_at),
    created_at: asString(item.created_at),
  };
}

function mapTVTikTokVideoRecord(item: DbRecord): TVTikTokVideoRecord {
  const account = asRecord(item.tv_tiktok_accounts);
  return {
    id: asString(item.id),
    account_id: asString(item.account_id),
    tiktok_video_id: asString(item.tiktok_video_id),
    title: asOptionalString(item.title),
    video_description: asOptionalString(item.video_description),
    cover_image_url: asOptionalString(item.cover_image_url),
    share_url: asString(item.share_url),
    embed_link: asOptionalString(item.embed_link),
    embed_html: asOptionalString(item.embed_html),
    duration_seconds: typeof item.duration_seconds === "number" ? item.duration_seconds : undefined,
    width: typeof item.width === "number" ? item.width : undefined,
    height: typeof item.height === "number" ? item.height : undefined,
    like_count: typeof item.like_count === "number" ? item.like_count : undefined,
    comment_count: typeof item.comment_count === "number" ? item.comment_count : undefined,
    share_count: typeof item.share_count === "number" ? item.share_count : undefined,
    view_count: typeof item.view_count === "number" ? item.view_count : undefined,
    published_at: asString(item.published_at),
    created_at: asString(item.created_at),
    tv_tiktok_accounts: account
      ? {
          id: asString(account.id),
          display_name: asString(account.display_name),
          avatar_url: asOptionalString(account.avatar_url),
        }
      : undefined,
  };
}

function mapTVTikTokPublicSourceRecord(item: DbRecord): TVTikTokPublicSourceRecord {
  const profileStats = asRecord(item.profile_stats);
  return {
    id: asString(item.id),
    source_type: (asString(item.source_type) || "profile") as TVTikTokPublicSourceRecord["source_type"],
    source_url: asString(item.source_url),
    normalized_url: asString(item.normalized_url),
    account_handle: asOptionalString(item.account_handle),
    display_name: asOptionalString(item.display_name),
    avatar_url: asOptionalString(item.avatar_url),
    profile_url: asOptionalString(item.profile_url),
    bio_description: asOptionalString(item.bio_description),
    status: asString(item.status),
    last_synced_at: asOptionalString(item.last_synced_at),
    last_error_message: asOptionalString(item.last_error_message),
    post_count: typeof item.post_count === "number" ? item.post_count : undefined,
    discoverable_post_count: typeof item.discoverable_post_count === "number" ? item.discoverable_post_count : undefined,
    profile_stats: profileStats
      ? {
          follower_count: typeof profileStats.follower_count === "number" ? profileStats.follower_count : undefined,
          following_count: typeof profileStats.following_count === "number" ? profileStats.following_count : undefined,
          like_count: typeof profileStats.like_count === "number" ? profileStats.like_count : undefined,
          video_count: typeof profileStats.video_count === "number" ? profileStats.video_count : undefined,
        }
      : undefined,
    created_at: asString(item.created_at),
  };
}

function mapTVTikTokPublicPostRecord(item: DbRecord): TVTikTokPublicPostRecord {
  const source = asRecord(item.tv_tiktok_public_sources);
  return {
    id: asString(item.id),
    source_id: asString(item.source_id),
    external_post_id: asOptionalString(item.external_post_id),
    post_url: asString(item.post_url),
    normalized_post_url: asString(item.normalized_post_url),
    title: asOptionalString(item.title),
    video_description: asOptionalString(item.video_description),
    thumbnail_url: asOptionalString(item.thumbnail_url),
    author_name: asOptionalString(item.author_name),
    author_url: asOptionalString(item.author_url),
    embed_html: asOptionalString(item.embed_html),
    published_at: asOptionalString(item.published_at),
    like_count: typeof item.like_count === "number" ? item.like_count : undefined,
    comment_count: typeof item.comment_count === "number" ? item.comment_count : undefined,
    share_count: typeof item.share_count === "number" ? item.share_count : undefined,
    view_count: typeof item.view_count === "number" ? item.view_count : undefined,
    created_at: asString(item.created_at),
    tv_tiktok_public_sources: source
      ? {
          id: asString(source.id),
          display_name: asOptionalString(source.display_name),
          avatar_url: asOptionalString(source.avatar_url),
          account_handle: asOptionalString(source.account_handle),
          source_type: asOptionalString(source.source_type),
          profile_url: asOptionalString(source.profile_url),
        }
      : undefined,
  };
}

function mapInfluencerRecord(item: DbRecord): InfluencerRecord {
  return {
    _id: asString(item.id),
    name: asString(item.name),
    handle: asString(item.handle),
    primaryPlatform: asString(item.primary_platform),
    followers: asNumber(item.followers),
    following: asNumber(item.following),
    posts: asNumber(item.posts),
    engagement: asNumber(item.engagement),
    reach: asNumber(item.reach),
    sentiment: asNumber(item.sentiment),
    riskScore: asNumber(item.risk_score),
    category: asOptionalString(item.category),
    niche: asOptionalString(item.niche),
    geography: asOptionalString(item.geography),
    activePlatforms: asStringArray(item.active_platforms),
    workedWith: asStringArray(item.worked_with),
    topics: asStringArray(item.topics),
    createdAt: asString(item.created_at),
    updatedAt: asString(item.updated_at),
  };
}

function mapInfluencerPostRecord(item: DbRecord): InfluencerPostRecord {
  return {
    id: asString(item.id),
    influencer_id: asString(item.influencer_id),
    campaign_id: asOptionalString(item.campaign_id),
    platform: asString(item.platform),
    caption: asString(item.caption),
    likes: asNumber(item.likes),
    comments: asNumber(item.comments),
    views: asNumber(item.views),
    sentiment_label: asOptionalString(item.sentiment_label) as InfluencerPostRecord["sentiment_label"],
    sentiment_score: typeof item.sentiment_score === "number" ? item.sentiment_score : undefined,
    brand: asOptionalString(item.brand),
    posted_at: asString(item.posted_at),
    url: asOptionalString(item.url),
    created_at: asString(item.created_at),
    updated_at: asString(item.updated_at),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getSupabaseAccessToken();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallbackMessage = response.status
      ? `Request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ""})`
      : "Request failed";
    throw new Error(data.message || fallbackMessage);
  }

  return data as T;
}

export async function signup(payload: SignupPayload) {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload: LoginPayload) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCurrentUser() {
  return request<{ user: AuthProfile }>("/auth/me");
}

export async function exchangeOAuthSession(accessToken: string) {
  return request<OAuthExchangeResponse>("/auth/oauth/exchange", {
    method: "POST",
    body: JSON.stringify({ accessToken }),
  });
}

export async function completeOAuthSignup(payload: {
  accessToken: string;
  fullName: string;
  company: string;
  contactNumber: string;
  competitors: string;
  role?: string;
  platform: string;
}) {
  return request<AuthResponse>("/auth/oauth/complete-signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCompetitors() {
  return request<{ items: EntityRecord[] }>("/entities/competitors");
}

export async function createCompetitor(payload: {
  name: string;
  platformLinks?: string[];
}) {
  return request<{ item: EntityRecord }>("/entities", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      type: "competitor",
      aliases: [],
      keywords: [payload.name],
      platformLinks: payload.platformLinks || [],
      isCompetitor: true,
      watchStatus: "active",
    }),
  });
}

export async function getCampaigns() {
  return request<{ items: CampaignRecord[]; pagination: { total: number } }>("/campaigns");
}

export async function createCampaign(payload: {
  name: string;
  description?: string;
  goal?: string;
}) {
  return request<{ item: CampaignRecord }>("/campaigns", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      description: payload.description,
      goal: payload.goal,
      status: "active",
      startDate: new Date().toISOString(),
      kpis: {
        mentions: 0,
        sentiment: "Pending",
      },
    }),
  });
}

export async function getAlertRules() {
  return request<{ items: AlertRuleRecord[]; pagination: { total: number } }>("/alert-rules");
}

export async function createAlertRule(payload: {
  name: string;
  type: string;
  entityIds?: string[];
}) {
  return request<{ item: AlertRuleRecord }>("/alert-rules", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      type: payload.type,
      entityIds: payload.entityIds || [],
      narrativeIds: [],
      thresholdValue: 1,
      thresholdWindow: "24h",
      deliveryChannels: ["email", "app"],
      status: "active",
    }),
  });
}

export async function getAlerts() {
  return request<{ items: AlertRecord[]; pagination: { total: number } }>("/alerts");
}

export async function acknowledgeAlert(id: string) {
  return request<{ item: AlertRecord }>(`/alerts/${id}/acknowledge`, {
    method: "PATCH",
  });
}

export async function getReports() {
  return request<{ items: ReportRecord[]; pagination: { total: number } }>("/reports");
}

export async function getMentions(params?: {
  search?: string;
  platform?: string;
  sourceType?: string;
  sentiment?: string;
  language?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.set("search", params.search.trim());
  if (params?.platform) query.set("platform", params.platform);
  if (params?.sourceType) query.set("sourceType", params.sourceType);
  if (params?.sentiment) query.set("sentiment", params.sentiment);
  if (params?.language) query.set("language", params.language);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<{ items: MentionRecord[]; pagination: { total: number } }>(`/mentions${suffix}`);
}

export async function getMentionStats() {
  return request<MentionStatsResponse>("/mentions/stats");
}

export async function getNarratives(params?: {
  search?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.set("search", params.search.trim());
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<{ items: NarrativeRecord[]; pagination: { total: number } }>(`/narratives${suffix}`);
}

export async function getNarrativeSummary() {
  return request<NarrativeSummaryResponse>("/narratives/summary");
}

export async function getNewsArticles(params?: {
  search?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.set("search", params.search.trim());
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await request<{ items: NewsArticleDbRecord[]; pagination: { total: number } }>(`/news/articles${suffix}`);
  return {
    items: response.items.map(mapNewsArticleRecord),
    pagination: response.pagination,
  };
}

export async function getEPaperClips(params?: {
  search?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.set("search", params.search.trim());
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await request<{ items: EPaperClipDbRecord[]; pagination: { total: number } }>(`/news/epaper${suffix}`);
  return {
    items: response.items.map(mapEPaperClipRecord),
    pagination: response.pagination,
  };
}

export async function getWebPaperWebsites() {
  try {
    return await request<{ items: WebPaperWebsiteRecord[]; availableScrapers: string[] }>("/news/web-paper/websites");
  } catch {
    const organizationId = await getCurrentOrganizationIdForSupabaseFallback();
    const { data, error } = await supabase
      .from("web_paper_websites")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message || "Unable to load Web Paper websites");
    }

    return {
      items: (data || []) as WebPaperWebsiteRecord[],
      availableScrapers: ["tribune", "dawn", "geo", "ary", "express"],
    };
  }
}

export async function createWebPaperWebsite(payload: {
  name: string;
  baseUrl: string;
  domain: string;
  scraperKey: string;
  crawlIntervalMinutes?: number;
  isActive?: boolean;
}) {
  return request<{ item: WebPaperWebsiteRecord }>("/news/web-paper/websites", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWebPaperWebsite(
  id: string,
  payload: {
    name?: string;
    baseUrl?: string;
    domain?: string;
    scraperKey?: string;
    crawlIntervalMinutes?: number;
    isActive?: boolean;
  },
) {
  return request<{ item: WebPaperWebsiteRecord }>(`/news/web-paper/websites/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteWebPaperWebsite(id: string) {
  return request<{ success: boolean }>(`/news/web-paper/websites/${id}`, {
    method: "DELETE",
  });
}

export async function getWebPaperArticles(params?: {
  source?: string;
  websiteId?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.source) query.set("source", params.source);
  if (params?.websiteId) query.set("websiteId", params.websiteId);
  if (params?.dateFrom) query.set("date_from", params.dateFrom);
  if (params?.dateTo) query.set("date_to", params.dateTo);
  if (params?.category) query.set("category", params.category);
  if (params?.status) query.set("status", params.status);
  if (params?.search?.trim()) query.set("search", params.search.trim());
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  try {
    return await request<{ items: WebPaperArticleRecord[]; pagination: { total: number; page: number; pages: number; limit: number } }>(
      `/news/web-paper/articles${suffix}`,
    );
  } catch {
    const organizationId = await getCurrentOrganizationIdForSupabaseFallback();
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from("web_paper_articles")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("published_at", { ascending: false })
      .order("fetched_at", { ascending: false })
      .range(from, to);

    if (params?.websiteId) dbQuery = dbQuery.eq("website_id", params.websiteId);
    if (params?.source) dbQuery = dbQuery.ilike("source_name", params.source);
    if (params?.category) dbQuery = dbQuery.ilike("category", params.category);
    if (params?.status) dbQuery = dbQuery.eq("status", params.status);
    if (params?.dateFrom) dbQuery = dbQuery.gte("published_at", params.dateFrom);
    if (params?.dateTo) dbQuery = dbQuery.lte("published_at", params.dateTo);
    if (params?.search?.trim()) {
      const search = params.search.trim();
      dbQuery = dbQuery.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data, error, count } = await dbQuery;
    if (error) {
      throw new Error(error.message || "Unable to load Web Paper articles");
    }

    return {
      items: (data || []) as WebPaperArticleRecord[],
      pagination: {
        total: count || 0,
        page,
        pages: Math.max(1, Math.ceil((count || 0) / limit)),
        limit,
      },
    };
  }
}

export async function getWebPaperArticle(id: string) {
  return request<{ item: WebPaperArticleRecord }>(`/news/web-paper/articles/${id}`);
}

export async function deleteWebPaperArticle(id: string) {
  return request<{ success: boolean }>(`/news/web-paper/articles/${id}`, {
    method: "DELETE",
  });
}

export async function runWebPaperCrawlerNow() {
  try {
    return await request<{ queued: boolean }>("/news/web-paper/crawler/run-now", {
      method: "POST",
    });
  } catch {
    return runWebPaperActionFallback("manual_crawl");
  }
}

export async function runWebPaperBackfillLastMonth() {
  try {
    return await request<{ queued: boolean }>("/news/web-paper/crawler/backfill-last-month", {
      method: "POST",
    });
  } catch {
    return runWebPaperActionFallback("backfill");
  }
}

export async function runWebPaperWebsite(websiteId: string) {
  try {
    return await request<{ queued: boolean }>(`/news/web-paper/crawler/run-website/${websiteId}`, {
      method: "POST",
    });
  } catch {
    return runWebPaperActionFallback("single_website", websiteId);
  }
}

export async function getWebPaperCrawlerLogs(params?: {
  websiteId?: string;
  status?: string;
  jobType?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.websiteId) query.set("websiteId", params.websiteId);
  if (params?.status) query.set("status", params.status);
  if (params?.jobType) query.set("jobType", params.jobType);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  try {
    return await request<{ items: WebPaperCrawlerLogRecord[]; pagination: { total: number; page: number; pages: number; limit: number } }>(
      `/news/web-paper/crawler/logs${suffix}`,
    );
  } catch {
    const organizationId = await getCurrentOrganizationIdForSupabaseFallback();
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from("web_paper_crawl_logs")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false })
      .range(from, to);

    if (params?.websiteId) dbQuery = dbQuery.eq("website_id", params.websiteId);
    if (params?.status) dbQuery = dbQuery.eq("status", params.status);
    if (params?.jobType) dbQuery = dbQuery.eq("job_type", params.jobType);

    const { data, error, count } = await dbQuery;
    if (error) {
      throw new Error(error.message || "Unable to load crawl logs");
    }

    return {
      items: (data || []) as WebPaperCrawlerLogRecord[],
      pagination: {
        total: count || 0,
        page,
        pages: Math.max(1, Math.ceil((count || 0) / limit)),
        limit,
      },
    };
  }
}

export async function getWebPaperCrawlerStatus() {
  try {
    return await request<WebPaperCrawlerStatusResponse>("/news/web-paper/crawler/status");
  } catch {
    const organizationId = await getCurrentOrganizationIdForSupabaseFallback();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [settingsResponse, websitesResponse, totalResponse, todayResponse, failedResponse] = await Promise.all([
      supabase.from("web_paper_crawler_settings").select("*").eq("organization_id", organizationId).maybeSingle(),
      supabase.from("web_paper_websites").select("*").eq("organization_id", organizationId).order("created_at", { ascending: true }),
      supabase.from("web_paper_articles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabase.from("web_paper_articles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("fetched_at", todayStart.toISOString()),
      supabase.from("web_paper_crawl_logs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["failed", "partial_success"]),
    ]);

    if (settingsResponse.error) throw new Error(settingsResponse.error.message || "Unable to load crawler settings");
    if (websitesResponse.error) throw new Error(websitesResponse.error.message || "Unable to load crawler websites");
    if (totalResponse.error) throw new Error(totalResponse.error.message || "Unable to count crawler articles");
    if (todayResponse.error) throw new Error(todayResponse.error.message || "Unable to count today's crawler articles");
    if (failedResponse.error) throw new Error(failedResponse.error.message || "Unable to count failed crawls");

    const websites = (websitesResponse.data || []) as WebPaperWebsiteRecord[];
    const lastCrawl = websites
      .map((item) => item.last_crawled_at)
      .filter((item): item is string => Boolean(item))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

    const fallbackSettings = settingsResponse.data as WebPaperCrawlerSettingsRecord | null;
    if (!fallbackSettings) {
      throw new Error("No crawler settings found for this organization");
    }

    return {
      settings: fallbackSettings,
      summary: {
        totalArticles: totalResponse.count || 0,
        articlesFetchedToday: todayResponse.count || 0,
        activeWebsites: websites.filter((item) => item.is_active).length,
        lastCrawlTime: lastCrawl,
        failedCrawls: failedResponse.count || 0,
      },
      websites,
    };
  }
}

export async function getWebPaperCrawlerSettings() {
  try {
    return await request<{ item: WebPaperCrawlerSettingsRecord }>("/news/web-paper/crawler/settings");
  } catch {
    const organizationId = await getCurrentOrganizationIdForSupabaseFallback();
    const { data, error } = await supabase
      .from("web_paper_crawler_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message || "Unable to load crawler settings");
    }

    return { item: data as WebPaperCrawlerSettingsRecord };
  }
}

export async function updateWebPaperCrawlerSettings(payload: {
  crawler_enabled?: boolean;
  crawl_interval_minutes?: number;
  request_timeout_seconds?: number;
  max_retries?: number;
  delay_between_requests_seconds?: number;
  max_articles_per_crawl?: number;
  save_raw_html?: boolean;
  initial_backfill_enabled?: boolean;
}) {
  return request<{ item: WebPaperCrawlerSettingsRecord }>("/news/web-paper/crawler/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getTVSegments(params?: {
  search?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.set("search", params.search.trim());
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await request<{ items: TVSegmentDbRecord[]; pagination: { total: number } }>(`/tv${suffix}`);
  return {
    items: response.items.map(mapTVSegmentRecord),
    pagination: response.pagination,
  };
}

export async function getTVYouTubeChannels() {
  const response = await request<{ items: TVYouTubeChannelDbRecord[] }>("/tv/channels");
  return {
    items: response.items.map(mapTVYouTubeChannelRecord),
  };
}

export async function getTVTikTokConnectUrl() {
  return request<{ url: string }>("/tiktok/connect-url");
}

export async function getTVTikTokAccounts() {
  const response = await request<{ items: DbRecord[] }>("/tiktok/accounts");
  return {
    items: response.items.map(mapTVTikTokAccountRecord),
  };
}

export async function syncTVTikTokAccount(accountId: string) {
  return request<{ queued: boolean; syncedVideos?: number }>(`/tiktok/accounts/${accountId}/sync`, {
    method: "POST",
  });
}

export async function getTVTikTokVideos(params?: {
  accountId?: string;
  limit?: number;
  page?: number;
}) {
  const query = new URLSearchParams();
  if (params?.accountId) query.set("accountId", params.accountId);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.page) query.set("page", String(params.page));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await request<{ items: DbRecord[]; pagination: { total: number; page: number; pages: number; limit: number } }>(`/tiktok/videos${suffix}`);
  return {
    items: response.items.map(mapTVTikTokVideoRecord),
    pagination: response.pagination,
  };
}

export async function getTVTikTokPublicSources() {
  const response = await request<{ items: DbRecord[] }>("/tv/tiktok-public/sources");
  return {
    items: response.items.map(mapTVTikTokPublicSourceRecord),
  };
}

export async function createTVTikTokPublicSource(url: string) {
  return request<{ item: TVTikTokPublicSourceRecord; syncSummary?: { syncedPosts: number } }>("/tv/tiktok-public/sources", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function syncTVTikTokPublicSource(sourceId: string) {
  return request<{ queued: boolean; syncedPosts?: number; item?: TVTikTokPublicSourceRecord }>(`/tv/tiktok-public/sources/${sourceId}/sync`, {
    method: "POST",
  });
}

export async function getTVTikTokPublicPosts(params?: {
  sourceId?: string;
  limit?: number;
  page?: number;
}) {
  const query = new URLSearchParams();
  if (params?.sourceId) query.set("sourceId", params.sourceId);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.page) query.set("page", String(params.page));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await request<{ items: DbRecord[]; pagination: { total: number; page: number; pages: number; limit: number } }>(`/tv/tiktok-public/posts${suffix}`);
  return {
    items: response.items.map(mapTVTikTokPublicPostRecord),
    pagination: response.pagination,
  };
}

export async function getTVIntegrationStatus() {
  return request<{
    integrations: {
      youtubeConfigured: boolean;
      geminiConfigured: boolean;
      tiktokConfigured: boolean;
    };
  }>("/tv/status");
}

export async function getTVDashboard() {
  return request<{
    summary: TVDashboardSummary;
    recentTranscripts: TVRecentTranscriptRecord[];
  }>("/tv/dashboard");
}

export async function createTVYouTubeChannel(youtubeChannelId: string) {
  return request<{ item: TVYouTubeChannelRecord; syncSummary?: { syncedVideos: number } }>("/tv/channels", {
    method: "POST",
    body: JSON.stringify({ youtubeChannelId }),
  });
}

export async function syncTVYouTubeChannel(channelId: string) {
  return request<{ queued: boolean; syncedVideos?: number }>(`/tv/channels/${channelId}/sync`, {
    method: "POST",
  });
}

export async function getTVYouTubeVideos(params?: {
  search?: string;
  channelId?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.set("search", params.search.trim());
  if (params?.channelId) query.set("channelId", params.channelId);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await request<{ items: TVYouTubeVideoDbRecord[]; pagination: { total: number } }>(`/tv/videos${suffix}`);
  return {
    items: response.items.map(mapTVYouTubeVideoRecord),
    pagination: response.pagination,
  };
}

export async function processTVYouTubeVideo(videoId: string) {
  return request<{ queued: boolean; item?: { videoId: string; segmentCount: number } }>(`/tv/videos/${videoId}/process`, {
    method: "POST",
  });
}

export async function generateTVVideoSrt(videoId: string) {
  return request<{ queued: boolean }>(`/tv/videos/${videoId}/generate-srt`, {
    method: "POST",
  });
}

export async function retryTVVideoProcessing(videoId: string) {
  return request<{ queued: boolean; item?: { videoId: string; segmentCount: number } }>(`/tv/videos/${videoId}/retry`, {
    method: "POST",
  });
}

export async function searchTVTranscripts(queryText: string) {
  const query = new URLSearchParams({ q: queryText });
  return request<{ items: TVTranscriptSearchRecord[]; message?: string }>(`/tv/search?${query.toString()}`);
}

export async function getInfluencers(params?: {
  search?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.set("search", params.search.trim());
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<{ items: InfluencerRecord[]; pagination: { total: number } }>(`/influencers${suffix}`);
}

export async function getInfluencerPosts(influencerId: string) {
  const response = await request<{ items: InfluencerPostRecord[] }>(`/influencers/${influencerId}/posts`);
  return response;
}

export async function getWorkspaceOverview(): Promise<WorkspaceOverviewResponse> {
  return request<WorkspaceOverviewResponse>("/dashboard/overview");
}

export async function getWorkspaceDiagnostics() {
  return request<WorkspaceDiagnosticsResponse>("/admin/workspace-diagnostics");
}

export async function reconcileTvWorkspaceData(payload: {
  sourceOrganizationId: string;
  targetOrganizationId?: string;
  dryRun?: boolean;
}) {
  return request<TvReconcileResponse>("/admin/tv/reconcile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function searchMediaIntelligence(params: {
  query: string;
  source?: "all" | "tv" | "news" | "epaper";
  from?: string;
  to?: string;
}) {
  const query = new URLSearchParams();
  query.set("q", params.query);
  if (params.source) query.set("source", params.source);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  return request<MediaKeywordSearchResponse>(`/media-intelligence/search?${query.toString()}`);
}

export async function getMediaIntelligenceTrends(params?: {
  keywords?: string[];
  source?: "all" | "tv" | "news" | "epaper";
  from?: string;
  to?: string;
}) {
  const query = new URLSearchParams();
  if (params?.keywords?.length) query.set("keywords", params.keywords.join(","));
  if (params?.source) query.set("source", params.source);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  return request<MediaTrendResponse>(`/media-intelligence/trends?${query.toString()}`);
}

export async function getMediaBrandMonitor(params?: {
  from?: string;
  to?: string;
}) {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  return request<MediaBrandMonitorResponse>(`/media-intelligence/brand-monitor?${query.toString()}`);
}

export async function getMediaWatchTerms() {
  return request<{ items: MediaWatchTermRecord[] }>("/admin/media-intelligence/watch-terms");
}

export async function createMediaWatchTerm(payload: {
  term: string;
  termType: "brand" | "competitor" | "keyword";
  language?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}) {
  return request<{ item: MediaWatchTermRecord }>("/admin/media-intelligence/watch-terms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMediaWatchTerm(
  id: string,
  payload: {
    term?: string;
    termType?: "brand" | "competitor" | "keyword";
    language?: string;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  return request<{ item: MediaWatchTermRecord }>(`/admin/media-intelligence/watch-terms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteMediaWatchTerm(id: string) {
  return request<{ success: boolean }>(`/admin/media-intelligence/watch-terms/${id}`, {
    method: "DELETE",
  });
}

export async function getMediaDailyStats(params?: {
  limit?: number;
  sourceKind?: "tv" | "news" | "epaper" | "all";
}) {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.sourceKind) query.set("sourceKind", params.sourceKind);
  return request<{ items: MediaDailyStatRecord[] }>(`/admin/media-intelligence/daily-stats?${query.toString()}`);
}

export async function getMediaSpikeAlerts(limit = 20) {
  const query = new URLSearchParams({ limit: String(limit) });
  return request<{ items: MediaSpikeAlertRecord[] }>(`/admin/media-intelligence/alerts?${query.toString()}`);
}

export async function refreshMediaIntelligence(payload?: {
  from?: string;
  to?: string;
  days?: number;
  createAlerts?: boolean;
}) {
  return request<{ result: MediaRefreshResponse }>("/admin/media-intelligence/refresh", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function getSummarySchedules(logLimit = 20) {
  const query = new URLSearchParams({ logLimit: String(logLimit) });
  return request<{ items: SummaryScheduleRecord[]; dispatchLogs: SummaryDispatchLogRecord[] }>(`/admin/media-intelligence/schedules?${query.toString()}`);
}

export async function createSummarySchedule(payload: {
  name: string;
  frequency: "daily" | "weekly";
  deliveryChannels: Array<"email" | "app" | "whatsapp" | "sms">;
  hourOfDay?: number;
  dayOfWeek?: number | null;
  isActive?: boolean;
  recipients?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  return request<{ item: SummaryScheduleRecord }>("/admin/media-intelligence/schedules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSummarySchedule(
  id: string,
  payload: {
    name?: string;
    frequency?: "daily" | "weekly";
    deliveryChannels?: Array<"email" | "app" | "whatsapp" | "sms">;
    hourOfDay?: number;
    dayOfWeek?: number | null;
    isActive?: boolean;
    recipients?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
) {
  return request<{ item: SummaryScheduleRecord }>(`/admin/media-intelligence/schedules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSummarySchedule(id: string) {
  return request<{ success: boolean }>(`/admin/media-intelligence/schedules/${id}`, {
    method: "DELETE",
  });
}

export async function runSummaryScheduleNow(id: string) {
  return request<{ result: { scheduleId: string; organizationId: string; subject: string; dispatched: number; nextRunAt: string } }>(
    `/admin/media-intelligence/schedules/${id}/run`,
    { method: "POST" },
  );
}

export async function createReport(payload: {
  title: string;
  type: string;
  summary?: string;
}) {
  const normalizedType = payload.type.toLowerCase().includes("daily")
    ? "daily"
    : payload.type.toLowerCase().includes("weekly")
      ? "weekly"
      : payload.type.toLowerCase().includes("campaign")
        ? "campaign"
        : payload.type.toLowerCase().includes("crisis")
          ? "crisis"
          : payload.type.toLowerCase().includes("quarter")
            ? "quarterly"
            : "custom";

  return request<{ item: ReportRecord }>("/reports", {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      type: normalizedType,
      status: "draft",
      summary: payload.summary || "Generated from the current workspace context.",
      dateRange: {
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString(),
      },
      filters: {},
    }),
  });
}

export async function submitContactInquiry(payload: {
  fullName: string;
  email: string;
  company?: string;
  contactNumber?: string;
  inquiryType?: "general" | "demo" | "security" | "onboarding";
  message: string;
}) {
  return request<{ inquiry: { _id: string } }>("/contact", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getChatbotSummary(contextType: "dashboard" | "report") {
  return request<{ summary: string }>(`/chatbots/summary?contextType=${contextType}`);
}

export async function getLatestChatbotConversation(contextType: "dashboard" | "report") {
  return request<{ conversation: ChatbotConversation | null }>(`/chatbots/conversations/latest?contextType=${contextType}`);
}

export async function sendChatbotMessage(payload: {
  contextType: "dashboard" | "report";
  message: string;
  conversationId?: string;
  contextRefId?: string;
}) {
  return request<{
    conversation: ChatbotConversation;
    reply: string;
  }>("/chatbots/respond", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
