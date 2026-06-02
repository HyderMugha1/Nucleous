import { useEffect, useMemo, useState } from "react";
import { Plus, Swords, Users, MessageSquareText, Heart, Share2, MessageCircle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend, LabelList } from "recharts";
import { PageVisualDeck } from "@/components/PageVisualDeck";
import { createCompetitor, getCompetitors, type EntityRecord } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const channelPosts = [
  { competitor: "Jazz", source: "Own Channel", platform: "Twitter/X", content: "New offer campaign update", likes: 1200, comments: 220, shares: 180 },
  { competitor: "Jazz", source: "Influencer", platform: "YouTube", content: "Telecom pricing reaction review", likes: 4200, comments: 640, shares: 330 },
  { competitor: "Telenor", source: "Own Channel", platform: "Instagram", content: "Network quality highlight", likes: 900, comments: 120, shares: 85 },
  { competitor: "Zong", source: "Influencer", platform: "Twitter/X", content: "Speed test comparison thread", likes: 1800, comments: 300, shares: 170 },
];

const sentimentByPlatform = [
  { platform: "Twitter/X", positive: 32, neutral: 21, negative: 47 },
  { platform: "YouTube", positive: 40, neutral: 28, negative: 32 },
  { platform: "Instagram", positive: 44, neutral: 30, negative: 26 },
  { platform: "News", positive: 35, neutral: 31, negative: 34 },
];

const overallSentiment = [
  { name: "Positive", value: 38, color: "#22C55E" },
  { name: "Neutral", value: 27, color: "#E6C36A" },
  { name: "Negative", value: 35, color: "#EF4444" },
];

const chartTooltipStyle = {
  background: "#0f172a",
  border: "1px solid rgba(148, 163, 184, 0.26)",
  borderRadius: "12px",
  fontSize: "11px",
  color: "#f8fafc",
  boxShadow: "0 14px 32px -20px rgba(2,6,23,0.8)",
};

function EntityTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string; fill?: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="min-w-[170px] rounded-xl border border-slate-500/35 bg-slate-950/95 px-3 py-2.5 text-[11px] text-slate-100 shadow-[0_18px_40px_-24px_rgba(2,6,23,0.95)] backdrop-blur-sm">
      {label && <p className="mb-2 border-b border-slate-700/70 pb-1.5 text-xs font-semibold text-white">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? entry.fill ?? "#94a3b8" }} />
              {entry.name}
            </span>
            <span className="font-semibold text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EntityConsole() {
  const [competitors, setCompetitors] = useState<EntityRecord[]>([]);
  const [newName, setNewName] = useState("");
  const [newLink, setNewLink] = useState("");

  useEffect(() => {
    let active = true;

    getCompetitors()
      .then((response) => {
        if (active) {
          setCompetitors(response.items);
        }
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Unable to load competitors",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    const posts = channelPosts.length;
    const comments = channelPosts.reduce((acc, p) => acc + p.comments, 0);
    const likes = channelPosts.reduce((acc, p) => acc + p.likes, 0);
    const shares = channelPosts.reduce((acc, p) => acc + p.shares, 0);
    return {
      influencers: 124,
      posts,
      comments,
      likes,
      shares,
      overallSentiment: "38/27/35",
    };
  }, []);

  const addCompetitor = () => {
    if (!newName.trim()) return;
    createCompetitor({
      name: newName.trim(),
      platformLinks: newLink ? [newLink] : [],
    })
      .then((response) => {
        setCompetitors((prev) => [...prev, response.item]);
        setNewName("");
        setNewLink("");
        toast({
          title: "Competitor added",
          description: `${response.item.name} is now part of the tracked watchlist.`,
        });
      })
      .catch((error) => {
        toast({
          title: "Unable to add competitor",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      });
  };

  const competitorComparison = useMemo(
    () =>
      competitors.map((c) => ({
        ...c,
        mentions: 0,
        sentiment: 50,
        sentimentScaled: 250,
      })),
    [competitors],
  );

  const radialSentiment = useMemo(
    () =>
      overallSentiment.map((item, index) => ({
        ...item,
        fill: item.color,
        innerRadius: 24 + index * 18,
        outerRadius: 36 + index * 18,
      })),
    [],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold premium-heading tracking-tight flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          Competition Analysis
        </h1>
        <p className="text-sm text-soft">Competitor performance across mentions, sentiment, and influencer-driven conversation</p>
      </div>

      <div className="reporting-grid grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          ["Influencers", totals.influencers],
          ["Posts", totals.posts],
          ["Comments", totals.comments],
          ["Likes", totals.likes],
          ["Shares", totals.shares],
          ["Overall Sentiment", totals.overallSentiment],
        ].map(([label, value]) => (
          <div key={String(label)} className="glass-premium reporting-card rounded-xl p-3">
            <p className="text-[10px] text-soft uppercase tracking-wide">{label}</p>
            <p className="text-sm font-semibold text-foreground font-mono mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="glass-premium rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Add Competitor</h2>
        <div className="flex flex-col md:flex-row gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Competitor name" className="h-10 rounded-lg border border-border/50 bg-muted/40 px-3 text-sm flex-1" />
          <input value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="Social media link" className="h-10 rounded-lg border border-border/50 bg-muted/40 px-3 text-sm flex-1" />
          <button onClick={addCompetitor} className="h-10 px-4 rounded-lg gradient-primary text-primary-foreground text-sm inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Add Competitor
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {competitors.map((c) => (
            <span key={c._id} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{c.name}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 chart-shell p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Competitor Volume vs Sentiment Index</h2>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={competitorComparison} layout="vertical" margin={{ top: 10, right: 24, left: 0, bottom: 4 }} barGap={6}>
              <defs>
                <linearGradient id="entityMentionsBar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.85} />
                </linearGradient>
                <linearGradient id="entitySentimentBar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity={0.85} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 5" horizontal={false} />
              <XAxis type="number" stroke="rgba(148,163,184,0.9)" fontSize={11} tickLine={false} axisLine={false} tickCount={6} />
              <YAxis dataKey="name" type="category" stroke="rgba(148,163,184,0.95)" fontSize={11} tickLine={false} axisLine={false} width={80} />
              <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<EntityTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#cbd5e1" }} />
              <Bar dataKey="mentions" name="Mentions" fill="url(#entityMentionsBar)" radius={[0, 10, 10, 0]} barSize={14}>
                <LabelList dataKey="mentions" position="right" fill="#e2e8f0" fontSize={10} />
              </Bar>
              <Bar dataKey="sentimentScaled" name="Sentiment Index (x5)" fill="url(#entitySentimentBar)" radius={[0, 10, 10, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-shell p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Overall Sentiment</h2>
          <div className="relative">
            <ResponsiveContainer width="100%" height={250}>
              <RadialBarChart innerRadius={18} outerRadius={94} data={radialSentiment} startAngle={90} endAngle={-270}>
                <RadialBar background={{ fill: "rgba(148,163,184,0.15)" }} dataKey="value" cornerRadius={10} />
                <Tooltip content={<EntityTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-full border border-border/40 bg-background/55 px-3 py-2 text-center backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[0.22em] text-soft">Balance</p>
                <p className="text-sm font-semibold text-foreground">38 / 27 / 35</p>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {overallSentiment.map((item) => (
              <span key={item.name} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/35 px-2 py-1 text-[10px] text-soft">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name} {item.value}%
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-shell p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Platform Sentiment Comparison</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={sentimentByPlatform} margin={{ top: 8, right: 14, left: 0, bottom: 4 }} barGap={8} barCategoryGap={18}>
            <defs>
              <linearGradient id="entityPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
              <linearGradient id="entityNeu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
              <linearGradient id="entityNeg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="platform" stroke="rgba(148,163,184,0.9)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="rgba(148,163,184,0.9)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<EntityTooltip />} />
            <Legend wrapperStyle={{ fontSize: "11px", color: "#cbd5e1" }} />
            <Bar dataKey="positive" fill="url(#entityPos)" radius={[6, 6, 0, 0]} barSize={18} />
            <Bar dataKey="neutral" fill="url(#entityNeu)" radius={[6, 6, 0, 0]} barSize={18} />
            <Bar dataKey="negative" fill="url(#entityNeg)" radius={[6, 6, 0, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-soft">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Positive</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Neutral</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Negative</span>
        </div>
      </div>

      <PageVisualDeck
        eyebrow="Entity Snapshot"
        title="Competitive conversation patterns"
        description="These quick visuals make it easier to compare owned, influencer, and sentiment movement before reviewing individual posts."
        cards={[
          { kind: "line", title: "Entity Momentum", value: "487", subtitle: "Top competitor mentions", footer: "Conversation acceleration", color: "#24c7d9", fill: "rgba(36, 199, 217, 0.16)", values: [28, 34, 31, 46, 52, 58, 63, 71] },
          { kind: "bar", title: "Creator Impact", value: "6.4K", subtitle: "Average interaction clusters", footer: "Influencer-led engagement", color: "#8b5cf6", values: [22, 29, 35, 41, 38, 47, 55] },
          { kind: "radial", title: "Sentiment Recovery", value: "38 / 27 / 35", subtitle: "Positive, neutral, negative", footer: "Overall response balance", color: "#f97360", progress: 62 },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-premium rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Own Channel Posts</h3>
          <div className="space-y-2">
            {channelPosts.filter((p) => p.source === "Own Channel").map((p) => (
              <div key={p.content} className="rounded-lg border border-border/40 p-2.5 bg-muted/20 text-xs text-soft">
                <p className="text-foreground mb-1">{p.content}</p>
                <p>{p.competitor} · {p.platform}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-premium rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-primary" /> Influencer Posts</h3>
          <div className="space-y-2">
            {channelPosts.filter((p) => p.source === "Influencer").map((p) => (
              <div key={p.content} className="rounded-lg border border-border/40 p-2.5 bg-muted/20 text-xs text-soft">
                <p className="text-foreground mb-1">{p.content}</p>
                <p className="mb-1">{p.competitor} · {p.platform}</p>
                <p className="font-mono flex items-center gap-2">
                  <Heart className="h-3.5 w-3.5" /> {p.likes}
                  <MessageCircle className="h-3.5 w-3.5" /> {p.comments}
                  <Share2 className="h-3.5 w-3.5" /> {p.shares}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
