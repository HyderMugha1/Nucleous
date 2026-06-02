import { NarrativeClusterCard } from "@/components/NarrativeClusterCard";
import { PageVisualDeck } from "@/components/PageVisualDeck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getNarratives, getNarrativeSummary, type NarrativeRecord, type NarrativeSummaryResponse } from "@/lib/api";
import { AlertTriangle, Network, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "@/hooks/use-toast";

const sentimentColors: Record<string, string> = {
  positive: "#22C55E",
  neutral: "#E6C36A",
  negative: "#EF4444",
  mixed: "#38BDF8",
};

export default function NarrativeMonitor() {
  const [narratives, setNarratives] = useState<NarrativeRecord[]>([]);
  const [summary, setSummary] = useState<NarrativeSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedNarrative, setSelectedNarrative] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getNarratives({ limit: 100 }), getNarrativeSummary()])
      .then(([narrativesResponse, summaryResponse]) => {
        if (!active) return;
        setNarratives(narrativesResponse.items);
        setSummary(summaryResponse);
        setSelectedNarrative(narrativesResponse.items[0]?._id || null);
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Unable to load narratives",
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

  const filteredNarratives = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return narratives;
    return narratives.filter((narrative) => `${narrative.title} ${narrative.summary} ${narrative.keywords.join(" ")}`.toLowerCase().includes(query));
  }, [narratives, search]);

  const selected = filteredNarratives.find((item) => item._id === selectedNarrative) || filteredNarratives[0] || null;

  const sentimentPie = useMemo(() => {
    const source = summary?.sentiment?.[0];
    if (!source) return [];
    return [
      { name: "Positive", value: source.positive, color: "#22C55E" },
      { name: "Neutral", value: source.neutral, color: "#E6C36A" },
      { name: "Negative", value: source.negative, color: "#EF4444" },
    ];
  }, [summary]);

  const trendData = useMemo(() => {
    return [...(summary?.trendPoints || [])]
      .sort((a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime())
      .slice(-8)
      .map((point) => ({
        label: new Date(point.bucket_start).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        mentions: point.mention_count,
        engagement: point.engagement_count,
        sentiment: Number(point.sentiment_score || 0),
      }));
  }, [summary]);

  const themeData = filteredNarratives.slice(0, 6).map((item) => ({
    title: item.title.length > 24 ? `${item.title.slice(0, 24)}...` : item.title,
    mentions: item.mentionCount,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 premium-heading">
            <Network className="h-5 w-5 text-primary" />
            Narrative Explorer
          </h1>
          <p className="text-sm text-soft">Live narrative clusters and momentum from the Supabase-backed backend.</p>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{filteredNarratives.length} active clusters</span>
      </div>

      <div className="glass-premium rounded-2xl p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search narratives, summaries, or keywords" className="pl-10" />
          </div>
          <Button variant="outline" onClick={() => setSearch("")}>Reset Search</Button>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-foreground">
          <p className="text-xs uppercase tracking-wide text-primary mb-1">Predictive Insight</p>
          {selected ? (
            <p>
              <span className="font-medium">{selected.title}</span> is currently {selected.trend}, with a momentum score of{" "}
              <span className="font-medium">{selected.momentumScore.toFixed(1)}</span> and risk score of{" "}
              <span className="font-medium">{selected.riskScore.toFixed(1)}</span>.
            </p>
          ) : (
            <p>Load narrative data to see predictive guidance.</p>
          )}
        </div>
      </div>

      <PageVisualDeck
        eyebrow="Narrative Signals"
        title="Velocity, sentiment, and confidence"
        description="The visual strip now reflects live narrative metrics instead of sample values."
        cards={[
          { kind: "line", title: "Trend Velocity", value: String(trendData[trendData.length - 1]?.mentions || 0), subtitle: "Latest bucket mentions", footer: "Current trend pulse", color: "#24c7d9", fill: "rgba(36, 199, 217, 0.16)", values: trendData.map((item) => item.mentions) },
          { kind: "bar", title: "Theme Density", value: String(filteredNarratives.length), subtitle: "Narratives in workspace", footer: "Top clusters by volume", color: "#8b5cf6", values: themeData.map((item) => item.mentions) },
          { kind: "radial", title: "Risk Read", value: selected ? selected.riskScore.toFixed(0) : "0", subtitle: "Selected narrative risk", footer: "Live risk score", color: "#f97360", progress: Math.min(100, Math.round(selected?.riskScore || 0)) },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="chart-shell p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Narrative Velocity</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid stroke="hsl(222, 16%, 14%)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="mentions" stroke="hsl(46,74%,68%)" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="engagement" stroke="#38BDF8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-shell p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Sentiment Pressure</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={sentimentPie} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={84} strokeWidth={0}>
                {sentimentPie.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-4">
        <div className="chart-shell p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top-performing Narratives</h3>
          <div className="space-y-2">
            {filteredNarratives.map((narrative) => (
              <button
                key={narrative._id}
                onClick={() => setSelectedNarrative(narrative._id)}
                className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${selected?._id === narrative._id ? "border-primary/40 bg-primary/10" : "border-border/40 bg-muted/20 hover:border-primary/20"}`}
              >
                <p className="text-xs text-foreground line-clamp-1">{narrative.title}</p>
                <p className="text-[10px] text-soft">{narrative.mentionCount} mentions</p>
              </button>
            ))}
            {!loading && filteredNarratives.length === 0 && <p className="text-sm text-muted-foreground">No narratives match the current search.</p>}
          </div>
        </div>

        <div className="chart-shell p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Volume by Narrative</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={themeData}>
              <CartesianGrid stroke="hsl(222, 16%, 14%)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="title" stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="mentions" radius={[6, 6, 0, 0]}>
                {themeData.map((item) => (
                  <Cell key={item.title} fill={sentimentColors[selected?.sentiment || "neutral"]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredNarratives.map((narrative) => (
          <NarrativeClusterCard
            key={narrative._id}
            title={narrative.title}
            mentionCount={narrative.mentionCount}
            sentiment={narrative.sentiment}
            trend={narrative.trend}
            topEntities={narrative.keywords}
            summary={narrative.summary}
          />
        ))}
      </div>

      <div className="glass-premium rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Smart Recommendations</h3>
        {selected ? (
          <div className="space-y-2 text-sm">
            <p className="text-foreground">1. Monitor <span className="text-primary">{selected.title}</span> closely while it remains {selected.trend}.</p>
            <p className="text-foreground">2. Prioritize response assets around {selected.keywords.slice(0, 3).join(", ") || "its primary keywords"}.</p>
            <p className="text-foreground">3. Escalate when risk moves beyond <span className="text-nucleus-negative">70</span>; current score is <span className="font-medium">{selected.riskScore.toFixed(1)}</span>.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Load a narrative to see recommendations.</p>
        )}
        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Live data from `/api/narratives` and `/api/narratives/summary`</div>
      </div>
    </div>
  );
}
