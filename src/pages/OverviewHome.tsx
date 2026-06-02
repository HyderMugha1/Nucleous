import { Activity, ArrowRight, BellRing, BrainCircuit, Globe2, Search, ShieldAlert, Sparkles, TrendingUp, Users, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { getWorkspaceOverview, type WorkspaceOverviewResponse } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const chartTooltipStyle = {
  background: "#ffffff",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: "14px",
  fontSize: "11px",
  color: "#142033",
  boxShadow: "0 16px 40px -24px rgba(15,23,42,0.35)",
};

const cardClass =
  "rounded-[1.7rem] border border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(250,246,240,0.88))] shadow-[0_18px_45px_-28px_rgba(15,23,42,0.22)] backdrop-blur-sm";

export default function OverviewHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [overview, setOverview] = useState<WorkspaceOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getWorkspaceOverview()
      .then((response) => {
        if (!active) return;
        setOverview(response);
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Unable to load workspace overview",
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

  const brandName = user?.company || "Your brand";
  const normalizedQuery = query.trim().toLowerCase();

  const overviewStats = useMemo(
    () => [
      { label: "Signals Monitored", value: String((overview?.metrics.mentionCount || 0) + (overview?.metrics.newsArticleCount || 0) + (overview?.metrics.tvSegmentCount || 0)), note: "Across social, news, and broadcast", icon: Activity },
      { label: "Active Narratives", value: String(overview?.metrics.narrativeCount || 0), note: "Live narrative clusters in this workspace", icon: TrendingUp },
      { label: "Competitors Tracked", value: String(overview?.metrics.competitorCount || 0), note: "Mapped to your workspace entities", icon: Users },
      { label: "Priority Alerts", value: String(overview?.metrics.openAlerts || 0), note: "Current open alert load", icon: ShieldAlert },
    ],
    [overview],
  );

  const intelligenceModules = useMemo(
    () => [
      { title: "Command Center", text: "Live dashboard for signals, summaries, and high-priority movement.", path: "/dashboard" },
      { title: "Mention Explorer", text: "Investigate top mentions, engagement shifts, and source-level detail.", path: "/mentions" },
      { title: "Narrative Monitor", text: "Track the stories building momentum and reputational pressure.", path: "/narratives" },
      { title: "TV Intelligence", text: "Review live broadcast segments, connected channels, and transcript search.", path: "/tv" },
    ],
    [],
  );

  const insightCards = useMemo(
    () =>
      (overview?.topNarratives || []).slice(0, 3).map((item) => ({
        title: item.title,
        text: item.summary,
        tone: item.sentiment === "negative" ? "warning" : item.sentiment === "positive" ? "positive" : "neutral",
        platforms: item.keywords.slice(0, 4),
      })),
    [overview],
  );

  const filteredInsights = useMemo(() => {
    return insightCards.filter((card) => {
      if (!normalizedQuery) return true;
      return `${card.title} ${card.text} ${card.platforms.join(" ")}`.toLowerCase().includes(normalizedQuery);
    });
  }, [insightCards, normalizedQuery]);

  const filteredModules = useMemo(() => {
    if (!normalizedQuery) return intelligenceModules;
    return intelligenceModules.filter((module) => `${module.title} ${module.text}`.toLowerCase().includes(normalizedQuery));
  }, [intelligenceModules, normalizedQuery]);

  const mentionTrendData = useMemo(() => {
    const mentions = overview?.latestMentions || [];
    const grouped = new Map<string, { label: string; total: number }>();
    mentions.forEach((mention) => {
      const label = new Date(mention.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const current = grouped.get(label) || { label, total: 0 };
      current.total += 1;
      grouped.set(label, current);
    });
    return Array.from(grouped.values()).slice(-7);
  }, [overview]);

  const platformMixData = (overview?.platformMix || []).map((item, index) => ({
    name: item.platform,
    value: item.value,
    color: ["#142033", "#7c3aed", "#ec4899", "#f97360", "#24c7d9", "#14b8a6", "#fb7185"][index % 7],
  }));

  const quickActions = [
    { label: "Open Command Center", path: "/dashboard" },
    { label: "Review Mentions", path: "/mentions" },
    { label: "Check TV", path: "/tv" },
    { label: "View Reports", path: "/reports" },
  ];

  return (
    <div className="animate-fade-in">
      <div className="rounded-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,#fffbf6_0%,#f5efe8_60%,#eee5db_100%)] p-4 text-slate-900 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.35)] md:p-6">
        <section className="relative flex min-h-[42vh] items-center justify-center overflow-hidden rounded-[1.9rem] border border-black/5 px-6 py-12 md:px-10">
          <div className="absolute inset-0 z-0" style={{ backgroundImage: 'url("/images/after-login-hero-bg.jpg")', backgroundSize: "cover", backgroundPosition: "center top" }} />
          <div className="absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.46),rgba(0,0,0,0.40),rgba(0,0,0,0.50))]" />
          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.14),transparent_48%),radial-gradient(circle_at_80%_85%,rgba(236,72,153,0.10),transparent_44%)]" />

          <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/12 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white shadow-[0_10px_30px_-20px_rgba(15,23,42,0.8)] backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-[#ffd7e8]" />
              Live Workspace Overview
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-[#ffd6c9] md:text-[0.8rem]">Dashboard for {brandName}</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.02em] text-white md:text-7xl">
              Unified intelligence overview
              <span className="mt-3 block bg-gradient-to-r from-[#f97360] via-[#ec4899] via-[#c026d3] to-[#38bdf8] bg-clip-text text-transparent">
                and cross-platform intelligence.
              </span>
            </h1>
            <p className="mt-6 max-w-3xl text-base font-medium leading-8 text-white/95 md:text-[1.18rem] md:leading-9">
              {loading ? "Loading live metrics for your workspace..." : `This is the live overview for ${brandName}, built directly from your Supabase workspace data.`}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => navigate("/dashboard")} className="h-12 rounded-full bg-white px-6 text-sm font-bold text-slate-900">
                Open Command Center
              </button>
              <button onClick={() => navigate("/reports")} className="h-12 rounded-full border border-white/45 bg-white/12 px-6 text-sm font-semibold text-white">
                Go to Reports
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mx-auto max-w-4xl">
            <div className={cardClass}>
              <div className="p-4 md:p-5">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search insights, narratives, competitors, and modules..."
                    className="h-16 rounded-[1.4rem] border-slate-200 bg-white pl-11 text-sm text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-[#faf7f3] px-3 py-1">Brand: {brandName}</span>
                  <span className="rounded-full border border-slate-200 bg-[#faf7f3] px-3 py-1">Mentions: {overview?.metrics.mentionCount || 0}</span>
                  <span className="rounded-full border border-slate-200 bg-[#faf7f3] px-3 py-1">Matching insights: {filteredInsights.length}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="reporting-grid mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewStats.map((item) => (
            <div key={item.label} className={`${cardClass} reporting-card p-5`}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
          <div className={`${cardClass} p-6`}>
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-slate-900">Cross-Platform Signal Trend</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Recent workspace mention movement.</p>
            <div className="mt-5 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mentionTrendData}>
                  <defs>
                    <linearGradient id="overviewLiveTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97360" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#f97360" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ebe7e2" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="total" stroke="#f97360" fill="url(#overviewLiveTotal)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${cardClass} p-6`}>
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-slate-900">Platform Mix</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Current distribution of visible workspace coverage.</p>
            <div className="mt-5 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={platformMixData} dataKey="value" innerRadius={58} outerRadius={88} paddingAngle={3}>
                    {platformMixData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid gap-2">
              {platformMixData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="flex-1 text-slate-600">{item.name}</span>
                  <span className="font-mono text-slate-950">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className={`${cardClass} p-6`}>
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-slate-900">Live Insights</p>
            </div>
            <div className="mt-5 grid gap-4">
              {filteredInsights.length > 0 ? (
                filteredInsights.map((card) => (
                  <div key={card.title} className="rounded-[1.3rem] border border-slate-200 bg-[#fcfaf8] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-950">{card.title}</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{card.text}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {card.platforms.map((platform) => (
                            <span key={platform} className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
                              {platform}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${card.tone === "warning" ? "bg-amber-100 text-amber-700" : card.tone === "positive" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                        {card.tone}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.3rem] border border-dashed border-slate-300 bg-[#fcfaf8] p-6 text-sm leading-7 text-slate-600">
                  No live insights match the current search query.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className={`${cardClass} p-6`}>
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-slate-900">Quick Actions</p>
              </div>
              <div className="mt-4 grid gap-3">
                {quickActions.map((action) => (
                  <button key={action.label} onClick={() => navigate(action.path)} className="flex items-center justify-between rounded-[1.2rem] border border-slate-200 bg-[#fcfaf8] px-4 py-3 text-left text-sm text-slate-600 transition-colors hover:border-primary/30 hover:text-slate-950">
                    <span>{action.label}</span>
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </button>
                ))}
              </div>
            </div>

            <div className={`${cardClass} p-6`}>
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-slate-900">Module Coverage</p>
              </div>
              <div className="mt-4 space-y-3">
                {filteredModules.map((module) => (
                  <button key={module.title} onClick={() => navigate(module.path)} className="block w-full rounded-[1.2rem] border border-slate-200 bg-[#fcfaf8] p-4 text-left transition-colors hover:border-primary/30">
                    <p className="text-sm font-semibold text-slate-950">{module.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{module.text}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
