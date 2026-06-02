import { ShieldAlert, AlertTriangle } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { SentimentBadge } from "@/components/SentimentBadge";
import { PageVisualDeck } from "@/components/PageVisualDeck";

const crisisItems = [
  { title: "Jazz Boycott Movement", severity: "critical", status: "active", mentions: 487, sentiment: "negative" as const, lastUpdate: "12m ago", summary: "Organized boycott gaining viral traction with 50K+ tweets. Brand reputation risk is high." },
  { title: "PTA Regulatory Backlash", severity: "high", status: "monitoring", mentions: 276, sentiment: "negative" as const, lastUpdate: "28m ago", summary: "Public criticism of PTA's handling of telecom price regulation. Government response expected." },
];

export default function CrisisRoom() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-nucleus-negative" />
          Crisis Room
        </h1>
        <p className="text-sm text-muted-foreground">Active crisis situations requiring immediate attention</p>
      </div>

      <div className="reporting-grid grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard title="Active Crises" value="2" changeType="negative" icon={<AlertTriangle className="h-4 w-4" />} />
        <MetricCard title="Total Mentions" value="763" change="+280% spike" changeType="negative" />
        <MetricCard title="Avg Sentiment" value="-0.68" change="Deeply negative" changeType="negative" />
        <MetricCard title="Response SLA" value="45m" change="Within target" changeType="positive" />
      </div>

      <PageVisualDeck
        eyebrow="Crisis Watch"
        title="Escalation patterns at a glance"
        description="This view surfaces spread, pressure, and response readiness before the detailed incident cards."
        cards={[
          { kind: "line", title: "Escalation Curve", value: "3.4x", subtitle: "Conversation acceleration", footer: "Last 8 checkpoints", color: "#ef4444", fill: "rgba(239, 68, 68, 0.18)", values: [8, 9, 12, 18, 29, 46, 58, 72] },
          { kind: "bar", title: "Response Load", value: "45m", subtitle: "Average action cadence", footer: "Ops, legal, comms", color: "#f97360", values: [24, 31, 28, 40, 54, 43, 36] },
          { kind: "radial", title: "Containment", value: "At Risk", subtitle: "Current control confidence", footer: "Needs closer monitoring", color: "#fb7185", progress: 38 },
        ]}
      />

      <div className="space-y-4">
        {crisisItems.map((c) => (
          <div key={c.title} className={`bg-card border rounded-lg p-5 ${c.severity === "critical" ? "border-nucleus-negative/40" : "border-border"}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${c.severity === "critical" ? "bg-nucleus-negative/20 text-nucleus-negative" : "bg-nucleus-neutral/20 text-nucleus-neutral"}`}>
                    {c.severity}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.status === "active" ? "bg-nucleus-negative/10 text-nucleus-negative animate-pulse-soft" : "bg-muted text-muted-foreground"}`}>
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{c.summary}</p>
              </div>
              <SentimentBadge sentiment={c.sentiment} />
            </div>
            <div className="flex items-center gap-4 text-[10px] text-nucleus-text-dim">
              <span className="font-mono">{c.mentions} mentions</span>
              <span>Last update: {c.lastUpdate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
