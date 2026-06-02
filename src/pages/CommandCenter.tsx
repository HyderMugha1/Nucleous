import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Globe, Monitor, Radio, TrendingUp, Zap } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricCard } from "@/components/MetricCard";
import { NarrativeClusterCard } from "@/components/NarrativeClusterCard";
import { MentionItem } from "@/components/MentionItem";
import { CommandCenterFilters } from "@/components/CommandCenterFilters";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageVisualDeck } from "@/components/PageVisualDeck";
import { getChatbotSummary, getMentions, getWorkspaceOverview, type MentionRecord, type WorkspaceOverviewResponse } from "@/lib/api";
import { useContextChatbot } from "@/hooks/useContextChatbot";
import { toast } from "@/hooks/use-toast";

const platforms = ["All", "Facebook", "Twitter/X", "Instagram", "YouTube", "LinkedIn", "TikTok", "Reddit", "TV", "News"];
const chartTooltipStyle = { background: "hsl(222, 24%, 9%)", border: "1px solid hsl(46, 74%, 68%, 0.25)", borderRadius: "10px", fontSize: "11px", color: "hsl(210, 20%, 92%)" };

function toDisplayLanguage(language?: string): "en" | "ur" | "rur" {
  if (language?.toLowerCase() === "ur") return "ur";
  if (language?.toLowerCase() === "rur") return "rur";
  return "en";
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) {
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function CommandCenter() {
  const [activePlatform, setActivePlatform] = useState("All");
  const [aiSummary, setAiSummary] = useState("Generating summary...");
  const [chatInput, setChatInput] = useState("");
  const [overview, setOverview] = useState<WorkspaceOverviewResponse | null>(null);
  const [mentions, setMentions] = useState<MentionRecord[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const {
    messages: chatMessages,
    sending: chatLoading,
    loadingHistory,
    error: chatError,
    sendMessage,
  } = useContextChatbot({
    contextType: "dashboard",
    fallbackAssistantMessage: "Ask me anything about sentiment, mentions, and narrative movement.",
  });

  useEffect(() => {
    let active = true;

    Promise.all([getWorkspaceOverview(), getMentions({ limit: 200 })])
      .then(([overviewResponse, mentionsResponse]) => {
        if (!active) return;
        setOverview(overviewResponse);
        setMentions(mentionsResponse.items);
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Unable to load command center",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (active) setLoadingOverview(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    getChatbotSummary("dashboard")
      .then((response) => setAiSummary(response.summary))
      .catch(() => setAiSummary("Unable to generate summary right now."));
  }, [activePlatform]);

  const visibleMentions = useMemo(() => {
    if (activePlatform === "All") return mentions;
    return mentions.filter((item) => item.platform === activePlatform || item.sourceType === activePlatform);
  }, [activePlatform, mentions]);

  const volumeData = useMemo(() => {
    const grouped = new Map<string, { time: string; mentions: number }>();
    visibleMentions.forEach((mention) => {
      const key = new Date(mention.publishedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      const current = grouped.get(key) || { time: key, mentions: 0 };
      current.mentions += 1;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort((a, b) => a.time.localeCompare(b.time)).slice(-8);
  }, [visibleMentions]);

  const platformDistribution = useMemo(
    () =>
      (overview?.platformMix || []).map((item, index) => ({
        platform: item.platform,
        value: item.value,
        color: ["hsl(217, 91%, 60%)", "hsl(220, 80%, 52%)", "hsl(280, 70%, 55%)", "hsl(0, 72%, 55%)", "hsl(170, 70%, 48%)", "hsl(46, 74%, 68%)"][index % 6],
      })),
    [overview],
  );

  const currentNarratives = useMemo(
    () =>
      (overview?.topNarratives || []).map((item) => ({
        title: item.title,
        mentions: item.mentionCount,
        sentiment: item.sentiment === "mixed" ? "neutral" : item.sentiment,
        trend: item.trend,
      })),
    [overview],
  );

  const narrativeCards = useMemo(
    () =>
      (overview?.topNarratives || []).map((item) => ({
        title: item.title,
        mentionCount: item.mentionCount,
        sentiment: item.sentiment,
        trend: item.trend,
        topEntities: item.keywords.slice(0, 3),
        summary: item.summary,
      })),
    [overview],
  );

  const latestAlerts = overview?.latestAlerts || [];
  const sentimentDistribution = overview?.sentimentDistribution || [
    { label: "Positive", value: 0 },
    { label: "Neutral", value: 0 },
    { label: "Negative", value: 0 },
  ];

  const topMentionsByEngagement = useMemo(
    () =>
      [...visibleMentions]
        .sort((a, b) => b.engagement.likes + b.engagement.comments + b.engagement.shares - (a.engagement.likes + a.engagement.comments + a.engagement.shares))
        .slice(0, 4),
    [visibleMentions],
  );

  const submitChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const nextPrompt = chatInput;
    setChatInput("");
    await sendMessage(nextPrompt);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight premium-heading">Command Center</h1>
          <p className="text-sm text-soft">{loadingOverview ? "Loading live workspace..." : "Live workspace intelligence from Supabase"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-nucleus-positive">
            <span className="h-2 w-2 rounded-full bg-nucleus-positive animate-pulse-soft" />
            Live
          </span>
        </div>
      </div>

      <CommandCenterFilters />

      <div className="glass-premium rounded-2xl p-4">
        <p className="text-primary text-xs uppercase tracking-wide mb-1">AI-generated Summary</p>
        <p className="text-sm text-soft">{aiSummary}</p>
      </div>

      <div className="glass-premium rounded-xl p-2">
        <Tabs value={activePlatform} onValueChange={setActivePlatform}>
          <TabsList className="bg-muted/30 border border-border/30 h-9 p-0.5 flex-wrap">
            {platforms.map((platform) => (
              <TabsTrigger key={platform} value={platform} className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                {platform}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="reporting-grid grid grid-cols-2 gap-4 md:grid-cols-5">
        <MetricCard title="Total Mentions" value={String(overview?.metrics.mentionCount || 0)} change={`${visibleMentions.length} currently visible`} changeType="positive" icon={<Activity className="h-4 w-4" />} />
        <MetricCard title="Active Narratives" value={String(overview?.metrics.narrativeCount || 0)} change={`${currentNarratives.length} highlighted`} changeType="neutral" icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard title="Risk Alerts" value={String(overview?.metrics.openAlerts || 0)} change={`${latestAlerts.length} latest shown`} changeType="negative" icon={<AlertTriangle className="h-4 w-4" />} />
        <MetricCard title="Sources Active" value={String(overview?.metrics.sourceCount || 0)} change={`${overview?.metrics.tvSegmentCount || 0} TV segments`} changeType="positive" icon={<Globe className="h-4 w-4" />} />
        <MetricCard title="Aggregated Sentiment" value={`${sentimentDistribution[0].value} / ${sentimentDistribution[1].value} / ${sentimentDistribution[2].value}`} change="Pos / Neu / Neg" changeType="neutral" icon={<BarChart3 className="h-4 w-4" />} />
      </div>

      <PageVisualDeck
        eyebrow="Signal Snapshot"
        title="Cross-platform pulse in one glance"
        description="This board is now generated from live workspace data instead of a fixed demo dataset."
        cards={[
          { kind: "line", title: "Live Volume", value: String(overview?.metrics.mentionCount || 0), subtitle: "Mentions in workspace", footer: platformDistribution[0]?.platform || "No dominant platform", color: "#24c7d9", fill: "rgba(36, 199, 217, 0.16)", values: volumeData.map((item) => item.mentions || 0) },
          { kind: "bar", title: "Source Intensity", value: String(overview?.metrics.sourceCount || 0), subtitle: "Active signal sources", footer: "Social, news, TV", color: "#8b5cf6", values: platformDistribution.map((item) => item.value || 0) },
          { kind: "radial", title: "Risk Pressure", value: `${overview?.metrics.openAlerts || 0} Alerts`, subtitle: "Current pressure", footer: "Open workspace alerts", color: "#f97360", progress: Math.min(100, (overview?.metrics.openAlerts || 0) * 10) },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 chart-shell scanline p-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            Platform Mention Volume
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={volumeData}>
              <defs>
                <linearGradient id="mentionGradientLive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(222, 16%, 14%)" strokeDasharray="3 3" />
              <XAxis dataKey="time" stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="mentions" stroke="hsl(217, 91%, 60%)" fill="url(#mentionGradientLive)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-shell scanline p-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Monitor className="h-4 w-4 text-primary" />
            Platform Split
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={platformDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" strokeWidth={0}>
                {platformDistribution.map((entry) => (
                  <Cell key={entry.platform} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {platformDistribution.map((item) => (
              <div key={item.platform} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-[10px] text-muted-foreground flex-1">{item.platform}</span>
                <span className="text-[10px] font-mono text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-shell p-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-nucleus-neutral" />
            Active Alerts
          </h2>
          <div className="space-y-3">
            {latestAlerts.length > 0 ? (
              latestAlerts.map((alert) => (
                <div key={alert._id} className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0 bg-nucleus-negative" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground line-clamp-2">{alert.message}</p>
                    <p className="text-[10px] text-nucleus-text-dim mt-0.5">{new Date(alert.triggeredAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No active alerts in this workspace.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="chart-shell p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Sentiment Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sentimentDistribution}>
              <CartesianGrid stroke="hsl(222, 16%, 14%)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                <Cell fill="#22C55E" />
                <Cell fill="#E6C36A" />
                <Cell fill="#EF4444" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-shell p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Top Mentions by Engagement</h2>
          <div className="space-y-2">
            {topMentionsByEngagement.length > 0 ? (
              topMentionsByEngagement.map((mention) => (
                <div key={`${mention._id}-${mention.platform}`} className="rounded-lg border border-border/40 bg-muted/20 p-2.5">
                  <p className="text-xs text-foreground line-clamp-2 mb-1">{mention.headline || mention.snippet || mention.body || "Untitled mention"}</p>
                  <div className="text-[10px] text-soft flex items-center justify-between">
                    <span>{mention.platform}</span>
                    <span className="font-mono">L {mention.engagement.likes} · C {mention.engagement.comments} · S {mention.engagement.shares}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No engaged mentions yet for this workspace.</p>
            )}
          </div>
        </div>

        <div className="chart-shell p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">AI Chat</h2>
          <div className="h-[162px] overflow-auto rounded-lg border border-border/40 bg-muted/20 p-2 space-y-2 mb-2">
            {loadingHistory && <p className="text-xs text-primary">Loading assistant history...</p>}
            {chatMessages.map((msg, idx) => (
              <p key={`${msg.role}-${idx}-${msg.content}`} className={`text-xs ${msg.role === "assistant" ? "text-soft" : "text-foreground"}`}>
                <span className="font-medium">{msg.role === "assistant" ? "Assistant" : "You"}:</span> {msg.content}
              </p>
            ))}
            {chatLoading && <p className="text-xs text-primary">Assistant is thinking...</p>}
            {chatError && <p className="text-xs text-nucleus-negative">{chatError}</p>}
          </div>
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about workspace movement..."
              className="flex-1 h-9 px-3 rounded-lg bg-muted/50 border border-border/60 text-xs focus:outline-none focus:ring-1 focus:ring-primary/45"
            />
            <button onClick={() => void submitChat()} className="h-9 px-3 rounded-lg text-xs gradient-primary text-primary-foreground">Send</button>
          </div>
        </div>
      </div>

      <div className="glass-premium rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          Active Narratives
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentNarratives.length > 0 ? (
            currentNarratives.map((item) => (
              <div key={item.title} className="chart-shell rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-1">{item.title}</h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.trend}</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{item.sentiment}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{item.mentions} mentions</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No narratives available yet.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Top Narrative Clusters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {narrativeCards.length > 0 ? narrativeCards.map((item) => <NarrativeClusterCard key={item.title} {...item} />) : <p className="text-sm text-muted-foreground">No narrative clusters yet.</p>}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Latest Mentions</h2>
        <div className="space-y-3">
          {visibleMentions.slice(0, 4).length > 0 ? (
            visibleMentions.slice(0, 4).map((mention) => (
              <MentionItem
                key={mention._id}
                title={mention.headline || mention.snippet || "Untitled mention"}
                source={mention.channelOrPublisher || mention.authorName || "Unknown source"}
                sourceType={mention.sourceType}
                timestamp={formatRelativeTime(mention.publishedAt)}
                sentiment={mention.sentiment.label}
                sentimentScore={mention.sentiment.score}
                entities={mention.tags.slice(0, 5)}
                snippet={mention.snippet || mention.body || "No preview available."}
                language={toDisplayLanguage(mention.language)}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No mentions found for this workspace.</p>
          )}
        </div>
      </div>
    </div>
  );
}
