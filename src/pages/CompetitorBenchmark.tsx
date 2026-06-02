import { Swords, ShieldAlert, TrendingUp, Activity, BarChart3, Sparkles } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { SentimentBadge } from "@/components/SentimentBadge";
import { MetricCard } from "@/components/MetricCard";
import { PageVisualDeck } from "@/components/PageVisualDeck";

const competitors = [
  { name: "Jazz", mentions: 487, sentiment: "negative" as const, share: 38, engagement: 74, risk: 82 },
  { name: "Telenor", mentions: 223, sentiment: "negative" as const, share: 17, engagement: 58, risk: 66 },
  { name: "Zong", mentions: 156, sentiment: "neutral" as const, share: 12, engagement: 50, risk: 44 },
  { name: "Ufone", mentions: 134, sentiment: "positive" as const, share: 10, engagement: 45, risk: 32 },
];

const chartData = competitors.map((c) => ({ name: c.name, mentions: c.mentions, engagement: c.engagement }));

const sovTrend = [
  { d: "Mon", Jazz: 30, Telenor: 21, Zong: 14, Ufone: 11 },
  { d: "Tue", Jazz: 34, Telenor: 18, Zong: 13, Ufone: 10 },
  { d: "Wed", Jazz: 36, Telenor: 16, Zong: 12, Ufone: 11 },
  { d: "Thu", Jazz: 41, Telenor: 15, Zong: 11, Ufone: 9 },
  { d: "Fri", Jazz: 38, Telenor: 17, Zong: 12, Ufone: 10 },
  { d: "Sat", Jazz: 35, Telenor: 18, Zong: 13, Ufone: 10 },
  { d: "Sun", Jazz: 37, Telenor: 17, Zong: 12, Ufone: 10 },
];

const riskPressure = [
  { label: "Jazz", risk: 82, momentum: 74 },
  { label: "Telenor", risk: 66, momentum: 58 },
  { label: "Zong", risk: 44, momentum: 50 },
  { label: "Ufone", risk: 32, momentum: 45 },
];

const sentimentMix = [
  { name: "Positive", value: 28, color: "#22C55E" },
  { name: "Neutral", value: 24, color: "#E6C36A" },
  { name: "Negative", value: 48, color: "#EF4444" },
];

const radarData = [
  { metric: "Mentions", Jazz: 92, Telenor: 51, Zong: 43, Ufone: 37 },
  { metric: "Engagement", Jazz: 74, Telenor: 58, Zong: 50, Ufone: 45 },
  { metric: "Risk", Jazz: 82, Telenor: 66, Zong: 44, Ufone: 32 },
  { metric: "Reach", Jazz: 88, Telenor: 62, Zong: 48, Ufone: 39 },
  { metric: "Sentiment", Jazz: 36, Telenor: 42, Zong: 58, Ufone: 63 },
];

const tooltipStyle = {
  background: "hsl(222, 24%, 9%)",
  border: "1px solid hsl(46, 74%, 68%, 0.25)",
  borderRadius: "12px",
  fontSize: "11px",
  color: "hsl(210, 20%, 92%)",
};

const shell = "rounded-[1.6rem] border border-border/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]";

export default function CompetitorBenchmark() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-[2rem] border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(230,195,106,0.18),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight premium-heading">
              <Swords className="h-5 w-5 text-primary" />
              Competitor Benchmark
            </h1>
            <p className="mt-1 text-sm text-soft">A cleaner competitive intelligence view for share of voice, pressure signals, and brand positioning.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Competitive pulse updated
          </div>
        </div>
      </div>

      <div className="reporting-grid grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard title="Total Competitor Mentions" value="1,284" change="+9.8% WoW" changeType="negative" icon={<Activity className="h-4 w-4" />} />
        <MetricCard title="Highest Risk Brand" value="Jazz" change="Risk score 82" changeType="negative" icon={<ShieldAlert className="h-4 w-4" />} />
        <MetricCard title="Fastest Momentum" value="Telenor" change="+18% surge" changeType="positive" icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard title="Share Leader" value="Jazz 38%" change="Stable dominance" changeType="neutral" icon={<Swords className="h-4 w-4" />} />
      </div>

      <PageVisualDeck
        eyebrow="Competition Pulse"
        title="Share, pressure, and position cues"
        description="Added a compact visual layer so brand comparison starts with a quick strategic read before the detailed benchmark charts."
        cards={[
          { kind: "line", title: "Share Momentum", value: "38%", subtitle: "Leader share of voice", footer: "Jazz stayed ahead all week", color: "#24c7d9", fill: "rgba(36, 199, 217, 0.16)", values: [30, 34, 36, 41, 38, 35, 37] },
          { kind: "bar", title: "Engagement Ladder", value: "74", subtitle: "Top competitor engagement", footer: "Interaction intensity by brand", color: "#8b5cf6", values: [74, 58, 50, 45] },
          { kind: "radial", title: "Pressure Index", value: "82", subtitle: "Highest risk competitor", footer: "Monitoring threshold elevated", color: "#f97360", progress: 82 },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className={shell}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Share of Voice Trend</h2>
              <p className="text-xs text-soft">Seven-day movement across primary telecom competitors.</p>
            </div>
            <div className="rounded-full bg-primary/10 px-3 py-1 text-[11px] text-primary">7 day view</div>
          </div>
          <div className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sovTrend} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="jazzGlow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#E6C36A" />
                    <stop offset="100%" stopColor="#f8e09d" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(222, 16%, 14%)" strokeDasharray="4 6" vertical={false} />
                <XAxis dataKey="d" stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="Jazz" stroke="url(#jazzGlow)" strokeWidth={3.2} dot={false} />
                <Line type="monotone" dataKey="Telenor" stroke="#38BDF8" strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="Zong" stroke="#22C55E" strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="Ufone" stroke="#EF4444" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={shell}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Sentiment Mix</h2>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sentimentMix} cx="50%" cy="50%" innerRadius={54} outerRadius={86} dataKey="value" strokeWidth={0}>
                  {sentimentMix.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {sentimentMix.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs text-soft">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                <span className="flex-1">{s.name}</span>
                <span className="font-mono text-foreground">{s.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className={shell}>
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Mention Volume vs Engagement</h2>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="mentionsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E6C36A" />
                    <stop offset="100%" stopColor="#8b6b1f" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(222, 16%, 14%)" strokeDasharray="4 6" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(215, 12%, 42%)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="mentions" fill="url(#mentionsFill)" radius={[10, 10, 0, 0]} />
                <Bar dataKey="engagement" fill="#38BDF8" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={shell}>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Risk vs Momentum</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskPressure} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="momentumFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(222, 16%, 14%)" strokeDasharray="4 6" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="risk" stroke="#EF4444" strokeWidth={2.5} fill="url(#riskFill)" />
                <Area type="monotone" dataKey="momentum" stroke="#22C55E" strokeWidth={2.5} fill="url(#momentumFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className={shell}>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Competitive Shape Radar</h2>
          <div className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(222, 16%, 14%)" />
                <PolarAngleAxis dataKey="metric" stroke="hsl(215, 12%, 42%)" fontSize={10} />
                <PolarRadiusAxis stroke="hsl(222, 16%, 14%)" fontSize={8} />
                <Radar name="Jazz" dataKey="Jazz" stroke="#E6C36A" fill="#E6C36A" fillOpacity={0.15} strokeWidth={2} />
                <Radar name="Telenor" dataKey="Telenor" stroke="#38BDF8" fill="#38BDF8" fillOpacity={0.1} strokeWidth={2} />
                <Radar name="Zong" dataKey="Zong" stroke="#22C55E" fill="#22C55E" fillOpacity={0.08} strokeWidth={2} />
                <Radar name="Ufone" dataKey="Ufone" stroke="#EF4444" fill="#EF4444" fillOpacity={0.08} strokeWidth={2} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-premium rounded-[1.8rem] overflow-hidden">
          <div className="border-b border-border/50 bg-muted/20 px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Competitor Table</h2>
            <p className="text-xs text-soft">Mentions, share, engagement pressure, and current tone in one place.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-background/20">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Competitor</th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Mentions</th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Share</th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Engagement</th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Risk</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c) => (
                <tr key={c.name} className="border-b border-border/30 transition-colors hover:bg-muted/20">
                  <td className="px-5 py-4 font-medium text-foreground">{c.name}</td>
                  <td className="px-5 py-4 text-right font-mono text-foreground">{c.mentions}</td>
                  <td className="px-5 py-4 text-right font-mono text-foreground">{c.share}%</td>
                  <td className="px-5 py-4 text-right font-mono text-foreground">{c.engagement}%</td>
                  <td className="px-5 py-4 text-right font-mono text-foreground">{c.risk}</td>
                  <td className="px-5 py-4"><SentimentBadge sentiment={c.sentiment} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
