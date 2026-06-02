import { MentionItem } from "@/components/MentionItem";
import { MetricCard } from "@/components/MetricCard";
import { MultiSelectChips } from "@/components/MultiSelectChips";
import { PageVisualDeck } from "@/components/PageVisualDeck";
import { Input } from "@/components/ui/input";
import { getMentions, getMentionStats, type MentionRecord, type MentionStatsResponse } from "@/lib/api";
import { Globe2, MessageSquare, Search, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import { toast } from "@/hooks/use-toast";

const platformOptions = ["Twitter/X", "Instagram", "Facebook", "YouTube", "TikTok", "LinkedIn", "Reddit", "TV", "News"];

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) {
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function normalizeLanguage(language?: string): "en" | "ur" | "rur" {
  if (!language) return "en";
  if (language.toLowerCase() === "ur") return "ur";
  if (language.toLowerCase() === "rur") return "rur";
  return "en";
}

export default function MentionExplorer() {
  const [mentions, setMentions] = useState<MentionRecord[]>([]);
  const [stats, setStats] = useState<MentionStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    Promise.all([getMentions({ limit: 100 }), getMentionStats()])
      .then(([mentionsResponse, statsResponse]) => {
        if (!active) return;
        setMentions(mentionsResponse.items);
        setStats(statsResponse);
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Unable to load mentions",
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

  const filteredMentions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return mentions.filter((mention) => {
      if (sentimentFilter !== "all" && mention.sentiment.label !== sentimentFilter) return false;
      if (languageFilter !== "all" && normalizeLanguage(mention.language) !== languageFilter) return false;
      if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(mention.platform)) return false;
      if (!query) return true;

      const haystack = [
        mention.headline,
        mention.snippet,
        mention.body,
        mention.authorName,
        mention.channelOrPublisher,
        mention.platform,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [languageFilter, mentions, search, selectedPlatforms, sentimentFilter]);

  const trendData = useMemo(() => {
    const buckets = new Map<string, { date: string; mentions: number; engagement: number }>();

    [...filteredMentions]
      .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
      .forEach((mention) => {
        const key = new Date(mention.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const current = buckets.get(key) || { date: key, mentions: 0, engagement: 0 };
        current.mentions += 1;
        current.engagement += mention.engagement.likes + mention.engagement.comments + mention.engagement.shares;
        buckets.set(key, current);
      });

    return Array.from(buckets.values()).slice(-7);
  }, [filteredMentions]);

  const platformData = useMemo(() => {
    const platformMap = new Map<string, number>();
    filteredMentions.forEach((mention) => {
      platformMap.set(mention.platform, (platformMap.get(mention.platform) || 0) + 1);
    });
    return Array.from(platformMap.entries())
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredMentions]);

  const topEntities = useMemo(() => {
    const entityMap = new Map<string, number>();
    filteredMentions.forEach((mention) => {
      mention.tags.forEach((tag) => {
        entityMap.set(tag, (entityMap.get(tag) || 0) + 1);
      });
    });
    return Array.from(entityMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredMentions]);

  const totalEngagement = filteredMentions.reduce(
    (sum, mention) => sum + mention.engagement.likes + mention.engagement.comments + mention.engagement.shares,
    0,
  );
  const averageSentiment = filteredMentions.length
    ? (filteredMentions.reduce((sum, mention) => sum + mention.sentiment.score, 0) / filteredMentions.length).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Mention Explorer</h1>
          <p className="mt-1 text-sm text-slate-600">Live mention intelligence from your Supabase-backed REST API.</p>
        </div>
        <div className="rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-medium text-primary">
          {loading ? "Loading mentions" : `${filteredMentions.length} mentions in view`}
        </div>
      </div>

      <div className="glass-premium rounded-2xl p-5 space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search mentions, sources, authors, or platforms" className="pl-10" />
          </div>
          <MultiSelectChips label="Platforms" options={platformOptions} selected={selectedPlatforms} onChange={setSelectedPlatforms} searchable />
        </div>

        <div className="flex flex-wrap gap-2">
          {["all", "positive", "neutral", "negative"].map((item) => (
            <button
              key={item}
              onClick={() => setSentimentFilter(item)}
              className={`rounded-full px-3 py-2 text-xs transition-colors ${sentimentFilter === item ? "bg-primary/15 text-primary border border-primary/20" : "border border-border/50 text-muted-foreground"}`}
            >
              {item}
            </button>
          ))}
          {["all", "en", "ur", "rur"].map((item) => (
            <button
              key={item}
              onClick={() => setLanguageFilter(item)}
              className={`rounded-full px-3 py-2 text-xs transition-colors ${languageFilter === item ? "bg-sky-500/15 text-sky-600 border border-sky-200" : "border border-border/50 text-muted-foreground"}`}
            >
              {item === "all" ? "All languages" : item.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard title="Total Mentions" value={stats?.total || 0} change={`${filteredMentions.length} currently filtered`} changeType="neutral" icon={<MessageSquare className="h-4 w-4" />} />
        <MetricCard title="Avg Sentiment" value={averageSentiment} change="Across visible mentions" changeType="positive" icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard title="Engagement" value={totalEngagement.toLocaleString()} change="Likes, comments, and shares" changeType="neutral" icon={<Users className="h-4 w-4" />} />
        <MetricCard
          title="Sentiment Mix"
          value={`${stats?.sentiment.positive || 0}/${stats?.sentiment.neutral || 0}/${stats?.sentiment.negative || 0}`}
          change="Positive / Neutral / Negative"
          changeType="neutral"
          icon={<Globe2 className="h-4 w-4" />}
        />
      </div>

      <PageVisualDeck
        eyebrow="Mention Patterns"
        title="Volume, engagement, and signal quality"
        description="This strip now reflects live mention data instead of a demo dataset."
        cards={[
          { kind: "line", title: "Volume Pulse", value: String(filteredMentions.length), subtitle: "Visible mention count", footer: "Current filtered workspace", color: "#24c7d9", fill: "rgba(36, 199, 217, 0.16)", values: trendData.map((item) => item.mentions || 0) },
          { kind: "bar", title: "Platform Spread", value: String(platformData.length), subtitle: "Platforms in current view", footer: "Top six channels", color: "#8b5cf6", values: platformData.map((item) => item.count || 0) },
          { kind: "radial", title: "Sentiment Signal", value: averageSentiment, subtitle: "Average score", footer: "Live blended signal", color: "#f97360", progress: Math.min(100, Number(averageSentiment)) },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="glass-premium rounded-2xl p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Mention Momentum</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} strokeDasharray="4 6" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
                <YAxis tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="mentions" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="engagement" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-premium rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Platform Mix</h2>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformData}>
                  <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} strokeDasharray="4 6" />
                  <XAxis dataKey="platform" tickLine={false} axisLine={false} stroke="#64748b" fontSize={10} />
                  <YAxis tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-premium rounded-2xl p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Top Tags</h2>
            <div className="space-y-2">
              {topEntities.length > 0 ? (
                topEntities.map((entity) => (
                  <div key={entity.name} className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm">
                    <span className="text-foreground">{entity.name}</span>
                    <span className="font-mono text-muted-foreground">{entity.count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No tags are available in the current mention set.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading && <div className="glass-premium rounded-2xl p-6 text-sm text-muted-foreground">Loading mentions...</div>}
        {!loading && filteredMentions.length === 0 && (
          <div className="glass-premium rounded-2xl p-6 text-sm text-muted-foreground">No mentions match the current filters.</div>
        )}
        {filteredMentions.map((mention) => (
          <MentionItem
            key={mention._id}
            title={mention.headline || mention.snippet || "Untitled mention"}
            source={mention.channelOrPublisher || mention.authorName || "Unknown source"}
            sourceType={mention.sourceType}
            timestamp={formatRelativeTime(mention.publishedAt)}
            sentiment={mention.sentiment.label}
            sentimentScore={mention.sentiment.score}
            entities={mention.tags.slice(0, 5)}
            snippet={mention.snippet || mention.body || "No preview available for this mention."}
            language={normalizeLanguage(mention.language)}
          />
        ))}
      </div>
    </div>
  );
}
