import { cn } from "@/lib/utils";

interface NarrativeClusterCardProps {
  title: string;
  mentionCount: number;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  trend: "rising" | "falling" | "stable";
  topEntities: string[];
  summary: string;
}

export function NarrativeClusterCard({ title, mentionCount, sentiment, trend, topEntities, summary }: NarrativeClusterCardProps) {
  return (
    <div className="glass-premium surface-float rounded-[1.7rem] p-5 hover:border-primary/35 transition-all duration-300 cursor-pointer animate-slide-up group hover:translate-y-[-4px]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Narrative Cluster</p>
          <h3 className="mt-2 text-base font-semibold leading-6 text-foreground group-hover:text-primary transition-colors line-clamp-2">{title}</h3>
        </div>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
          trend === "rising" && "bg-nucleus-negative/10 text-nucleus-negative",
          trend === "falling" && "bg-nucleus-positive/10 text-nucleus-positive",
          trend === "stable" && "bg-muted text-muted-foreground",
        )}>
          {trend === "rising" ? "↑ Rising" : trend === "falling" ? "↓ Falling" : "→ Stable"}
        </span>
      </div>
      <p className="mb-4 text-sm leading-6 text-muted-foreground line-clamp-3">{summary}</p>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
        <div
          className={cn(
            "h-full rounded-full",
            sentiment === "positive" && "bg-nucleus-positive",
            sentiment === "negative" && "bg-nucleus-negative",
            sentiment === "neutral" && "bg-nucleus-neutral",
            sentiment === "mixed" && "bg-accent",
          )}
          style={{ width: `${Math.min(100, Math.max(24, (mentionCount / 400) * 100))}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {topEntities.slice(0, 3).map((e) => (
            <span key={e} className="rounded-full border border-primary/15 bg-primary/8 px-2 py-1 text-[10px] font-medium text-primary">{e}</span>
          ))}
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">{mentionCount} mentions</span>
      </div>
    </div>
  );
}
