import { PageVisualDeck } from "@/components/PageVisualDeck";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createTVYouTubeChannel,
  getTVDashboard,
  getTVIntegrationStatus,
  getTVYouTubeChannels,
  getTVYouTubeVideos,
  processTVYouTubeVideo,
  retryTVVideoProcessing,
  searchTVTranscripts,
  syncTVYouTubeChannel,
  type TVDashboardSummary,
  type TVRecentTranscriptRecord,
  type TVTranscriptSearchRecord,
  type TVYouTubeChannelRecord,
  type TVYouTubeVideoRecord,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import {
  Calendar,
  Clock3,
  ExternalLink,
  RefreshCw,
  Search,
  Sparkles,
  Tv,
  Video,
  Youtube,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatDay(value?: string | null) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds < 1) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function compactNumber(value?: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function statusTone(status: string) {
  if (status === "completed") return "bg-emerald-500/12 text-emerald-700 border-emerald-500/20";
  if (status === "processing") return "bg-sky-500/12 text-sky-700 border-sky-500/20";
  if (status === "queued") return "bg-amber-500/12 text-amber-700 border-amber-500/20";
  if (status === "failed") return "bg-rose-500/12 text-rose-700 border-rose-500/20";
  return "bg-slate-500/12 text-slate-700 border-slate-500/20";
}

const EMPTY_SUMMARY: TVDashboardSummary = {
  channels: 0,
  videos: 0,
  transcriptSegments: 0,
  completedVideos: 0,
  processingVideos: 0,
  queuedVideos: 0,
  failedVideos: 0,
  pendingVideos: 0,
  latestVideoPublishedAt: null,
  latestChannelSyncAt: null,
};

export default function TVIntelligence() {
  const [integrationStatus, setIntegrationStatus] = useState<{
    youtubeConfigured: boolean | null;
    geminiConfigured: boolean | null;
  }>({
    youtubeConfigured: null,
    geminiConfigured: null,
  });
  const [summary, setSummary] = useState<TVDashboardSummary>(EMPTY_SUMMARY);
  const [recentTranscripts, setRecentTranscripts] = useState<TVRecentTranscriptRecord[]>([]);
  const [youtubeChannels, setYoutubeChannels] = useState<TVYouTubeChannelRecord[]>([]);
  const [youtubeVideos, setYoutubeVideos] = useState<TVYouTubeVideoRecord[]>([]);
  const [transcriptResults, setTranscriptResults] = useState<TVTranscriptSearchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [youtubeChannelId, setYoutubeChannelId] = useState("");
  const [videoSearch, setVideoSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("All");
  const [transcriptSearch, setTranscriptSearch] = useState("");

  const deferredVideoSearch = useDeferredValue(videoSearch);

  const loadTvPage = useCallback(async (options?: { withGlobalLoader?: boolean }) => {
    const withGlobalLoader = options?.withGlobalLoader ?? false;
    if (withGlobalLoader) {
      setLoading(true);
    }

    try {
      const selectedChannel = youtubeChannels.find((channel) => channel.channel_name === channelFilter);

      const [statusResponse, dashboardResponse, channelsResponse, videosResponse] = await Promise.all([
        getTVIntegrationStatus(),
        getTVDashboard(),
        getTVYouTubeChannels(),
        getTVYouTubeVideos({
          limit: 18,
          search: deferredVideoSearch.trim() || undefined,
          channelId: selectedChannel?.id,
        }),
      ]);

      setIntegrationStatus({
        youtubeConfigured: statusResponse.integrations.youtubeConfigured,
        geminiConfigured: statusResponse.integrations.geminiConfigured,
      });
      setSummary(dashboardResponse.summary);
      setRecentTranscripts(dashboardResponse.recentTranscripts);
      setYoutubeChannels(channelsResponse.items);
      setYoutubeVideos(videosResponse.items);
    } catch (error) {
      toast({
        title: "Unable to load TV intelligence",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      if (withGlobalLoader) {
        setLoading(false);
      }
    }
  }, [channelFilter, deferredVideoSearch, youtubeChannels]);

  useEffect(() => {
    void loadTvPage({ withGlobalLoader: true });
  }, [loadTvPage]);

  useEffect(() => {
    if (loading) return;
    void loadTvPage();
  }, [loadTvPage, loading]);

  const channelOptions = useMemo(() => ["All", ...youtubeChannels.map((channel) => channel.channel_name)], [youtubeChannels]);

  const publishingTrend = useMemo(() => {
    const buckets = new Map<string, number>();

    youtubeVideos.forEach((video) => {
      const key = formatDay(video.published_at);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    });

    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count })).slice(-8);
  }, [youtubeVideos]);

  const processingBreakdown = useMemo(
    () => [
      { label: "Done", value: summary.completedVideos },
      { label: "Queued", value: summary.queuedVideos },
      { label: "Running", value: summary.processingVideos },
      { label: "Failed", value: summary.failedVideos },
      { label: "Pending", value: summary.pendingVideos },
    ],
    [summary],
  );

  const addYouTubeChannel = async () => {
    if (!youtubeChannelId.trim()) return;

    try {
      setActionLoading("add-channel");
      const response = await createTVYouTubeChannel(youtubeChannelId.trim());
      toast({
        title: "Channel connected",
        description: response.syncSummary?.syncedVideos
          ? `Imported ${response.syncSummary.syncedVideos} recent videos from YouTube.`
          : "Channel connected successfully.",
      });
      setYoutubeChannelId("");
      await loadTvPage();
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

  const refreshChannel = async (channelId: string) => {
    try {
      setActionLoading(`sync-${channelId}`);
      const response = await syncTVYouTubeChannel(channelId);
      toast({
        title: "Channel refreshed",
        description: response.syncedVideos ? `${response.syncedVideos} videos refreshed from YouTube.` : "Channel sync completed.",
      });
      await loadTvPage();
    } catch (error) {
      toast({
        title: "Unable to refresh channel",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const transcribeVideo = async (videoId: string, retry = false) => {
    try {
      setActionLoading(`${retry ? "retry" : "process"}-${videoId}`);
      const response = retry ? await retryTVVideoProcessing(videoId) : await processTVYouTubeVideo(videoId);
      toast({
        title: retry ? "Transcription retried" : "Transcription complete",
        description: response.item?.segmentCount
          ? `${response.item.segmentCount} transcript segments saved.`
          : "Video transcript updated.",
      });
      await loadTvPage();
    } catch (error) {
      toast({
        title: retry ? "Retry failed" : "Unable to transcribe video",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const runTranscriptSearch = async () => {
    if (!transcriptSearch.trim()) {
      setTranscriptResults([]);
      return;
    }

    try {
      setActionLoading("search-transcripts");
      const response = await searchTVTranscripts(transcriptSearch.trim());
      setTranscriptResults(response.items);

      if (response.items.length === 0) {
        toast({
          title: "No transcript match found",
          description: response.message || "Try a different phrase.",
        });
      }
    } catch (error) {
      toast({
        title: "Unable to search transcripts",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Tv className="h-6 w-6 text-primary" />
            TV Intelligence
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Monitor connected YouTube channels, open videos on YouTube, run transcript generation, and search directly into spoken moments.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            TikTok is paused for now and will be re-enabled once your official TikTok API access is ready.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadTvPage({ withGlobalLoader: true })} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <PageVisualDeck
        eyebrow="Live Workspace Feed"
        title="Channel sync, video coverage, and transcript health"
        description="These cards now reflect real connected YouTube channels and transcript progress from your workspace."
        cards={[
          {
            kind: "line",
            title: "Synced Videos",
            value: compactNumber(summary.videos),
            subtitle: `${summary.channels} connected channel${summary.channels === 1 ? "" : "s"}`,
            footer: summary.latestVideoPublishedAt ? `Latest video ${formatDay(summary.latestVideoPublishedAt)}` : "No recent video yet",
            color: "#ff7a59",
            fill: "rgba(255, 122, 89, 0.18)",
            values: publishingTrend.map((item) => item.count),
          },
          {
            kind: "bar",
            title: "Transcript Segments",
            value: compactNumber(summary.transcriptSegments),
            subtitle: `${summary.completedVideos} videos transcribed`,
            footer: summary.latestChannelSyncAt ? `Last channel sync ${formatDay(summary.latestChannelSyncAt)}` : "Sync your first channel",
            color: "#0ea5e9",
            values: processingBreakdown.map((item) => item.value),
          },
          {
            kind: "radial",
            title: "Processing Health",
            value: `${summary.completedVideos}/${summary.videos}`,
            subtitle: "Completed vs total",
            footer: summary.failedVideos > 0 ? `${summary.failedVideos} videos need attention` : "No failed transcripts right now",
            color: "#22c55e",
            progress: summary.videos ? Math.round((summary.completedVideos / summary.videos) * 100) : 0,
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="glass-premium rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">YouTube Sources</h2>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_auto]">
            <Input
              value={youtubeChannelId}
              onChange={(event) => setYoutubeChannelId(event.target.value)}
              placeholder="Add YouTube channel ID, @handle, or URL"
              disabled={integrationStatus.youtubeConfigured === false}
            />
            <Button
              onClick={() => void addYouTubeChannel()}
              disabled={integrationStatus.youtubeConfigured === false || !youtubeChannelId.trim() || actionLoading === "add-channel"}
            >
              Connect Channel
            </Button>
          </div>

          {integrationStatus.youtubeConfigured === false ? (
            <p className="text-xs text-muted-foreground">
              Add `YOUTUBE_API_KEY` in Vercel Project Settings -&gt; Environment Variables, then redeploy to enable channel sync.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Paste a channel ID, `@handle`, or full YouTube channel URL. The app imports recent videos immediately so the TV page is ready right away.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {youtubeChannels.length > 0 ? (
              youtubeChannels.map((channel) => (
                <div key={channel.id} className="rounded-2xl border border-border/40 bg-background/40 p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    {channel.thumbnail_url ? (
                      <img src={channel.thumbnail_url} alt={channel.channel_name} className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Youtube className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{channel.channel_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{channel.youtube_channel_id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-muted/30 p-3">
                      <p className="text-lg font-semibold text-foreground">{compactNumber(channel.video_count)}</p>
                      <p className="text-[11px] text-muted-foreground">Videos</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-3">
                      <p className="text-lg font-semibold text-foreground">{compactNumber(channel.transcribed_video_count)}</p>
                      <p className="text-[11px] text-muted-foreground">Transcribed</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-3">
                      <p className="text-sm font-semibold text-foreground">{formatDay(channel.latest_video_published_at)}</p>
                      <p className="text-[11px] text-muted-foreground">Latest</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void refreshChannel(channel.id)}
                      disabled={actionLoading === `sync-${channel.id}`}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Refresh Videos
                    </Button>
                    {channel.channel_url ? (
                      <a href={channel.channel_url} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm">
                          Open Channel
                        </Button>
                      </a>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted-foreground">Last synced: {formatDateTime(channel.last_synced_at)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/50 p-5 text-sm text-muted-foreground">
                Connect your first YouTube channel to populate the TV workspace with real videos and transcript-ready records.
              </div>
            )}
          </div>
        </div>

        <div className="glass-premium rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Processing Snapshot</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-background/40 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Completed</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{compactNumber(summary.completedVideos)}</p>
            </div>
            <div className="rounded-2xl bg-background/40 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Failed</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{compactNumber(summary.failedVideos)}</p>
            </div>
            <div className="rounded-2xl bg-background/40 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Queued</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{compactNumber(summary.queuedVideos)}</p>
            </div>
            <div className="rounded-2xl bg-background/40 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Running</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{compactNumber(summary.processingVideos)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/40 bg-background/30 p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Recent Upload Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={publishingTrend}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} strokeDasharray="4 6" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
                <YAxis tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#ff7a59" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-premium rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Recent YouTube Videos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review synced videos, open them on YouTube, and run transcript generation from the workspace.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={videoSearch}
              onChange={(event) => setVideoSearch(event.target.value)}
              placeholder="Search videos by title or YouTube ID"
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {channelOptions.map((channel) => (
              <button
                key={channel}
                onClick={() => setChannelFilter(channel)}
                className={`rounded-full border px-3 py-2 text-xs transition-colors ${
                  channelFilter === channel
                    ? "border-primary/20 bg-primary/15 text-primary"
                    : "border-border/50 text-muted-foreground"
                }`}
              >
                {channel}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {youtubeVideos.length > 0 ? (
            youtubeVideos.map((video) => (
              <div key={video.id} className="rounded-2xl border border-border/40 bg-background/30 p-4 space-y-4">
                <div className="flex gap-4">
                  <a href={video.youtube_url} target="_blank" rel="noreferrer" className="shrink-0">
                    {video.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt={video.title} className="h-28 w-44 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-28 w-44 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Video className="h-6 w-6" />
                      </div>
                    )}
                  </a>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone(video.processing_status)}`}>
                        {video.processing_status}
                      </span>
                      <span className="text-xs text-muted-foreground">{video.transcript_segment_count || 0} transcript segments</span>
                    </div>

                    <div>
                      <p className="line-clamp-2 text-base font-semibold text-foreground">{video.title}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDay(video.published_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatDuration(video.duration_seconds)}
                        </span>
                        <span>{video.tv_youtube_channels?.channel_name || "Unknown channel"}</span>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {video.transcript_preview ||
                        (video.processing_status === "failed"
                          ? video.latest_job_error || "Transcript generation failed for this video."
                          : video.processing_status === "completed"
                            ? "Transcript completed, but no preview text is available yet."
                            : "Transcript has not been generated for this video yet.")}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <a href={video.youtube_url} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm">
                          Open on YouTube
                          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void transcribeVideo(video.id)}
                        disabled={integrationStatus.geminiConfigured === false || actionLoading === `process-${video.id}`}
                      >
                        Generate Transcript
                      </Button>
                      {video.processing_status === "failed" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void transcribeVideo(video.id, true)}
                          disabled={integrationStatus.geminiConfigured === false || actionLoading === `retry-${video.id}`}
                        >
                          Retry
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border/50 p-5 text-sm text-muted-foreground xl:col-span-2">
              No synced YouTube videos match your current filters yet.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="glass-premium rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Transcript Search</h2>
          </div>
          <div className="flex gap-3">
            <Input
              value={transcriptSearch}
              onChange={(event) => setTranscriptSearch(event.target.value)}
              placeholder="Search any word or phrase from available transcripts"
            />
            <Button variant="outline" onClick={() => void runTranscriptSearch()} disabled={actionLoading === "search-transcripts"}>
              Search
            </Button>
          </div>

          <div className="space-y-3">
            {transcriptResults.length > 0 ? (
              transcriptResults.map((result) => (
                <div key={result.id} className="rounded-2xl border border-border/40 bg-background/30 p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">{result.videoTitle}</p>
                  <p className="text-sm text-muted-foreground">{result.matchText}</p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-primary">Jump to {Math.floor(result.startSec)}s</span>
                    <a href={result.youtubeRedirectUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      Open clip
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Search transcript segments to jump straight into the matching YouTube moment.
              </p>
            )}
          </div>
        </div>

        <div className="glass-premium rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Latest Transcript Wins</h2>
          </div>

          <div className="space-y-3">
            {recentTranscripts.length > 0 ? (
              recentTranscripts.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border/40 bg-background/30 p-4 space-y-3">
                  <div className="flex gap-3">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt={item.title} className="h-20 w-28 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-20 w-28 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Video className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.channel_name} • {formatDay(item.published_at)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.transcript_preview || "Transcript preview is not available yet."}</p>
                  <a href={item.youtube_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Open on YouTube
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Once transcripts are generated, the freshest transcript previews will appear here.
              </p>
            )}
          </div>
        </div>
      </div>

      {loading ? <div className="glass-premium rounded-2xl p-5 text-sm text-muted-foreground">Loading TV workspace...</div> : null}
    </div>
  );
}
