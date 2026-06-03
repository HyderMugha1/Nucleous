import { PageVisualDeck } from "@/components/PageVisualDeck";
import { MediaIntelligencePanel } from "@/components/MediaIntelligencePanel";
import { SentimentBadge } from "@/components/SentimentBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createTVYouTubeChannel,
  getTVIntegrationStatus,
  getTVTikTokAccounts,
  getTVTikTokConnectUrl,
  getTVTikTokVideos,
  getTVSegments,
  getTVYouTubeChannels,
  getTVYouTubeVideos,
  processTVYouTubeVideo,
  retryTVVideoProcessing,
  syncTVTikTokAccount,
  searchTVTranscripts,
  syncTVYouTubeChannel,
  type TVTikTokAccountRecord,
  type TVTikTokVideoRecord,
  type TVSegmentRecord,
  type TVTranscriptSearchRecord,
  type TVYouTubeChannelRecord,
  type TVYouTubeVideoRecord,
} from "@/lib/api";
import { Calendar, ExternalLink, Mic, RotateCcw, Search, Tv, Youtube } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

function formatDay(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TVIntelligence() {
  const { user } = useAuth();
  const [integrationStatus, setIntegrationStatus] = useState({
    youtubeConfigured: false,
    geminiConfigured: false,
    tiktokConfigured: false,
  });
  const [segments, setSegments] = useState<TVSegmentRecord[]>([]);
  const [youtubeChannels, setYoutubeChannels] = useState<TVYouTubeChannelRecord[]>([]);
  const [youtubeVideos, setYoutubeVideos] = useState<TVYouTubeVideoRecord[]>([]);
  const [tiktokAccounts, setTikTokAccounts] = useState<TVTikTokAccountRecord[]>([]);
  const [tiktokVideos, setTikTokVideos] = useState<TVTikTokVideoRecord[]>([]);
  const [transcriptResults, setTranscriptResults] = useState<TVTranscriptSearchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("All");
  const [youtubeChannelId, setYoutubeChannelId] = useState("");
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const monitoredChannels = useMemo(() => {
    const channelSet = new Set<string>();
    segments.forEach((item) => channelSet.add(item.channel));
    youtubeChannels.forEach((item) => channelSet.add(item.channel_name));
    return Array.from(channelSet).sort((a, b) => a.localeCompare(b));
  }, [segments, youtubeChannels]);

  useEffect(() => {
    let active = true;

    Promise.all([
      getTVIntegrationStatus(),
      getTVSegments({ limit: 100 }),
      getTVYouTubeChannels(),
      getTVYouTubeVideos({ limit: 100 }),
      getTVTikTokAccounts(),
      getTVTikTokVideos({ limit: 24 }),
    ])
      .then(([statusResponse, segmentsResponse, channelsResponse, videosResponse, tiktokAccountsResponse, tiktokVideosResponse]) => {
        if (!active) return;
        setIntegrationStatus(statusResponse.integrations);
        setSegments(segmentsResponse.items);
        setYoutubeChannels(channelsResponse.items);
        setYoutubeVideos(videosResponse.items);
        setTikTokAccounts(tiktokAccountsResponse.items);
        setTikTokVideos(tiktokVideosResponse.items);
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Unable to load TV intelligence",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const tiktokStatus = query.get("tiktok");
    if (!tiktokStatus) return;

    if (tiktokStatus === "connected") {
      toast({
        title: "TikTok connected",
        description: "TikTok account connected and sync queued.",
      });
    } else if (tiktokStatus === "error") {
      toast({
        title: "TikTok connection failed",
        description: "Check your TikTok app credentials and redirect URI settings.",
        variant: "destructive",
      });
    }

    query.delete("tiktok");
    const nextQuery = query.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  const runTranscriptSearch = async () => {
    if (!transcriptSearch.trim()) {
      setTranscriptResults([]);
      return;
    }
    try {
      const response = await searchTVTranscripts(transcriptSearch.trim());
      setTranscriptResults(response.items);
      if (response.items.length === 0) {
        toast({
          title: "Search complete",
          description: response.message || "No record found.",
        });
      }
    } catch (error) {
      toast({
        title: "Unable to search transcripts",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const addYouTubeChannel = async () => {
    if (!youtubeChannelId.trim()) return;
    try {
      setActionLoading("add-channel");
      const response = await createTVYouTubeChannel(youtubeChannelId.trim());
      setYoutubeChannels((current) => [response.item, ...current]);
      setYoutubeChannelId("");
      toast({
        title: "YouTube channel connected",
        description: "Channel saved and initial sync queued.",
      });
    } catch (error) {
      toast({
        title: "Unable to connect channel",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const queueChannelSync = async (channelId: string) => {
    try {
      setActionLoading(`sync-${channelId}`);
      await syncTVYouTubeChannel(channelId);
      toast({
        title: "Channel sync queued",
        description: "Videos will start syncing in the background worker.",
      });
    } catch (error) {
      toast({
        title: "Unable to sync channel",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const queueVideoProcessing = async (videoId: string) => {
    try {
      setActionLoading(`process-${videoId}`);
      await processTVYouTubeVideo(videoId);
      setYoutubeVideos((current) => current.map((video) => (video.id === videoId ? { ...video, processing_status: "queued" } : video)));
      toast({
        title: "Transcription queued",
        description: "Gemini transcription will run in the background.",
      });
    } catch (error) {
      toast({
        title: "Unable to queue transcription",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const queueRetry = async (videoId: string) => {
    try {
      setActionLoading(`retry-${videoId}`);
      await retryTVVideoProcessing(videoId);
      setYoutubeVideos((current) => current.map((video) => (video.id === videoId ? { ...video, processing_status: "queued" } : video)));
      toast({
        title: "Retry queued",
        description: "Failed processing will be retried in the background.",
      });
    } catch (error) {
      toast({
        title: "Unable to retry processing",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const connectTikTok = async () => {
    try {
      setActionLoading("tiktok-connect");
      const response = await getTVTikTokConnectUrl();
      window.location.href = response.url;
    } catch (error) {
      toast({
        title: "Unable to start TikTok connection",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const queueTikTokSync = async (accountId: string) => {
    try {
      setActionLoading(`tiktok-sync-${accountId}`);
      await syncTVTikTokAccount(accountId);
      toast({
        title: "TikTok sync queued",
        description: "TikTok videos will start syncing in the background worker.",
      });
    } catch (error) {
      toast({
        title: "Unable to sync TikTok account",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredSegments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return segments.filter((segment) => {
      if (channelFilter !== "All" && segment.channel !== channelFilter) return false;
      if (!query) return true;
      return `${segment.channel} ${segment.show_name} ${segment.anchor_name || ""} ${segment.headline} ${segment.transcript_snippet || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [channelFilter, search, segments]);

  const coverageTrend = useMemo(() => {
    const buckets = new Map<string, number>();
    filteredSegments.forEach((segment) => {
      const date = formatDay(segment.aired_at);
      buckets.set(date, (buckets.get(date) || 0) + 1);
    });
    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count })).slice(-7);
  }, [filteredSegments]);

  const channelCoverage = useMemo(() => {
    const buckets = new Map<string, number>();
    filteredSegments.forEach((segment) => {
      buckets.set(segment.channel, (buckets.get(segment.channel) || 0) + 1);
    });
    return Array.from(buckets.entries())
      .map(([channel, mentions]) => ({ channel, mentions }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 8);
  }, [filteredSegments]);

  const positiveCount = filteredSegments.filter((segment) => segment.sentiment_label === "positive").length;
  const neutralCount = filteredSegments.filter((segment) => !segment.sentiment_label || segment.sentiment_label === "neutral").length;
  const negativeCount = filteredSegments.filter((segment) => segment.sentiment_label === "negative").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Tv className="h-6 w-6 text-primary" />
          TV Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Live TV coverage and broadcast sentiment from your REST backend.</p>
      </div>

      <PageVisualDeck
        eyebrow="Broadcast Visuals"
        title="Coverage rhythm, channel pressure, and sentiment"
        description="TV dashboards now reflect live segments instead of demo cards."
        cards={[
          { kind: "line", title: "Coverage Rhythm", value: String(filteredSegments.length), subtitle: "Visible segments", footer: "Current filtered feed", color: "#24c7d9", fill: "rgba(36, 199, 217, 0.16)", values: coverageTrend.map((item) => item.count) },
          { kind: "bar", title: "Channel Pressure", value: String(channelCoverage[0]?.mentions || 0), subtitle: "Top channel count", footer: channelCoverage[0]?.channel || "No channel data", color: "#8b5cf6", values: channelCoverage.map((item) => item.mentions) },
          { kind: "radial", title: "Tone Health", value: `${positiveCount}/${neutralCount}/${negativeCount}`, subtitle: "P / N / Neg", footer: "Visible sentiment mix", color: "#f97360", progress: filteredSegments.length ? Math.round((positiveCount / filteredSegments.length) * 100) : 0 },
        ]}
      />

      <div className="glass-premium rounded-2xl p-5 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search channels, anchors, shows, or headlines" className="pl-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          {["All", ...monitoredChannels].map((channel) => (
            <button
              key={channel}
              onClick={() => setChannelFilter(channel)}
              className={`rounded-full px-3 py-2 text-xs transition-colors ${channelFilter === channel ? "bg-primary/15 text-primary border border-primary/20" : "border border-border/50 text-muted-foreground"}`}
            >
              {channel}
            </button>
          ))}
        </div>
      </div>

      <MediaIntelligencePanel defaultSource="tv" />

      <div className="glass-premium rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">YouTube TV Transcripts</h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_auto]">
          <Input
            value={youtubeChannelId}
            onChange={(event) => setYoutubeChannelId(event.target.value)}
            placeholder="Add YouTube channel ID"
            disabled={!integrationStatus.youtubeConfigured}
          />
          <Button
            onClick={() => void addYouTubeChannel()}
            disabled={!integrationStatus.youtubeConfigured || !youtubeChannelId.trim() || actionLoading === "add-channel"}
          >
            Connect Channel
          </Button>
        </div>
        {!integrationStatus.youtubeConfigured && (
          <p className="text-xs text-muted-foreground">
            Add `YOUTUBE_API_KEY` in Vercel Project Settings -&gt; Environment Variables, then redeploy to enable channel connection.
          </p>
        )}

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Connected Channels</h3>
            {youtubeChannels.length > 0 ? (
              youtubeChannels.map((channel) => (
                <div key={channel.id} className="rounded-xl border border-border/40 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{channel.channel_name}</p>
                      <p className="text-xs text-muted-foreground">{channel.youtube_channel_id}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void queueChannelSync(channel.id)}
                      disabled={!integrationStatus.youtubeConfigured || actionLoading === `sync-${channel.id}`}
                    >
                      Sync
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No YouTube channels connected yet.</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex gap-3">
              <Input
                value={transcriptSearch}
                onChange={(event) => setTranscriptSearch(event.target.value)}
                placeholder="Search any word or phrase from transcripts"
              />
              <Button variant="outline" onClick={() => void runTranscriptSearch()}>
                Search
              </Button>
            </div>
            {transcriptResults.length > 0 ? (
              transcriptResults.map((result) => (
                <div key={result.id} className="rounded-xl border border-border/40 bg-muted/20 p-4">
                  <p className="text-sm font-semibold text-foreground">{result.videoTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{result.matchText}</p>
                  <p className="mt-2 text-xs text-primary">Timestamp: {Math.floor(result.startSec)}s</p>
                  <a href={result.youtubeRedirectUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Open on YouTube <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Search transcript segments to jump directly into a video moment.</p>
            )}
          </div>
        </div>
      </div>

      <div className="glass-premium rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-foreground">TikTok Video Feed</h2>
            <p className="text-sm text-muted-foreground mt-1">Connect a TikTok creator account with TikTok Login + Display API, then sync recent public videos into this workspace.</p>
          </div>
          <Button onClick={() => void connectTikTok()} disabled={!integrationStatus.tiktokConfigured || actionLoading === "tiktok-connect"}>
            Connect TikTok
          </Button>
        </div>
        {!integrationStatus.tiktokConfigured && (
          <p className="text-xs text-muted-foreground">
            Add `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`, and `CLIENT_URL` in Vercel, then redeploy to enable TikTok connection.
          </p>
        )}

        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Connected TikTok Accounts</h3>
            {tiktokAccounts.length > 0 ? (
              tiktokAccounts.map((account) => (
                <div key={account.id} className="rounded-xl border border-border/40 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{account.display_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{account.profile_url || account.tiktok_open_id}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Last synced: {account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : "Never"}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void queueTikTokSync(account.id)}
                      disabled={!integrationStatus.tiktokConfigured || actionLoading === `tiktok-sync-${account.id}`}
                    >
                      Sync
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No TikTok accounts connected yet. TikTok requires Login Kit, approved scopes, and an `https` redirect URI.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Recent TikTok Videos</h3>
            {tiktokVideos.length > 0 ? (
              tiktokVideos.slice(0, 12).map((video) => (
                <div key={video.id} className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{video.title || video.video_description || "Untitled TikTok video"}</p>
                      <p className="text-xs text-muted-foreground">
                        {video.tv_tiktok_accounts?.display_name || "TikTok creator"} - {formatDay(video.published_at)}
                      </p>
                    </div>
                    <a href={video.share_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {video.embed_html ? (
                    <div className="overflow-hidden rounded-xl border border-border/40 bg-background/40 p-2" dangerouslySetInnerHTML={{ __html: video.embed_html }} />
                  ) : video.cover_image_url ? (
                    <img src={video.cover_image_url} alt={video.title || "TikTok video"} className="h-48 w-full rounded-xl object-cover" />
                  ) : null}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{video.view_count || 0} views</span>
                    <span>{video.like_count || 0} likes</span>
                    <span>{video.comment_count || 0} comments</span>
                    <span>{video.share_count || 0} shares</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Synced TikTok videos will appear here after account sync runs.</p>
            )}
          </div>
        </div>
      </div>

      <div className="glass-premium rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">YouTube Video Processing</h3>
        {!integrationStatus.geminiConfigured && (
          <p className="text-xs text-muted-foreground">
            Add `GEMINI_API_KEY` in Vercel to enable transcript processing and retries.
          </p>
        )}
        {youtubeVideos.length > 0 ? (
          youtubeVideos.slice(0, 12).map((video) => (
            <div key={video.id} className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{video.title}</p>
                <p className="text-xs text-muted-foreground">
                  {video.tv_youtube_channels?.channel_name || "Unknown channel"} - {video.processing_status}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void queueVideoProcessing(video.id)}
                  disabled={!integrationStatus.geminiConfigured || actionLoading === `process-${video.id}`}
                >
                  Process
                </Button>
                {video.processing_status === "failed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void queueRetry(video.id)}
                    disabled={!integrationStatus.geminiConfigured || actionLoading === `retry-${video.id}`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Synced YouTube videos will appear here after channel sync runs.</p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-premium rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">TV Coverage by Day</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={coverageTrend}>
              <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} strokeDasharray="4 6" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
              <YAxis tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#24c7d9" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-premium rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top Channels</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={channelCoverage}>
              <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} strokeDasharray="4 6" />
              <XAxis dataKey="channel" tickLine={false} axisLine={false} stroke="#64748b" fontSize={10} />
              <YAxis tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
              <Tooltip />
              <Bar dataKey="mentions" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-3">
        {loading && <div className="glass-premium rounded-2xl p-5 text-sm text-muted-foreground">Loading TV segments...</div>}
        {!loading && filteredSegments.length === 0 && (
          <div className="glass-premium rounded-2xl p-5 text-sm text-muted-foreground space-y-2">
            <p>No TV segments match the current filters.</p>
            <p>
              TV data is workspace-scoped. The page only shows rows that belong to your logged-in organization
              {user?.company ? ` (${user.company})` : ""}.
            </p>
            <p>If you inserted rows manually, make sure their `organization_id` matches your current workspace.</p>
          </div>
        )}
        {filteredSegments.map((segment) => (
          <div key={segment.id} className="glass-premium rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-primary">{segment.channel}</span>
              <span className="text-xs text-muted-foreground">{segment.show_name}</span>
              {segment.anchor_name && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mic className="h-3 w-3" /> {segment.anchor_name}</span>}
              <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDay(segment.aired_at)}</span>
              {segment.sentiment_label && <SentimentBadge sentiment={segment.sentiment_label} score={segment.sentiment_score} />}
            </div>
            <h3 className="text-lg font-semibold text-foreground">{segment.headline}</h3>
            <p className="text-sm text-muted-foreground">{segment.transcript_snippet || "No transcript snippet was stored for this segment."}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
