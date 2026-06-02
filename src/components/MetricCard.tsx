import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
  className?: string;
}

export function MetricCard({ title, value, change, changeType = "neutral", icon, className }: MetricCardProps) {
  const sparkline = [18, 32, 24, 40, 38, 52, 46, 58];
  const sparkColor =
    changeType === "positive" ? "#22c55e" : changeType === "negative" ? "#fb7185" : "#24c7d9";
  const sentimentBreakdown =
    typeof value === "string" ? value.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/) : null;
  const hasSentimentPie = title.toLowerCase().includes("sentiment") && Boolean(sentimentBreakdown);
  const positive = sentimentBreakdown ? Number(sentimentBreakdown[1]) : 0;
  const neutral = sentimentBreakdown ? Number(sentimentBreakdown[2]) : 0;
  const negative = sentimentBreakdown ? Number(sentimentBreakdown[3]) : 0;

  return (
    <div className={cn(
      "glass-premium reporting-card surface-float rounded-[1.7rem] p-4 md:p-5 hover:border-primary/30 transition-all duration-300 animate-fade-in hover:scale-[1.02]",
      className
    )}>
      <div className="mb-4 flex items-start justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{title}</span>
        {icon && <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-white/70 text-primary shadow-[0_10px_26px_-20px_rgba(15,23,42,0.35)]">{icon}</div>}
      </div>
      <div className="text-3xl font-semibold tracking-[-0.04em] text-foreground">{value}</div>
      {hasSentimentPie && (
        <div className="mt-3 flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-full border border-white/35"
            style={{
              background: `conic-gradient(#22c55e 0 ${positive}%, #e6c36a ${positive}% ${positive + neutral}%, #ef4444 ${positive + neutral}% 100%)`,
            }}
          >
            <div className="m-[6px] h-9 w-9 rounded-full bg-black/15 backdrop-blur-sm" />
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full bg-black/15 px-2 py-0.5 text-white/95">P {positive}%</span>
            <span className="rounded-full bg-black/15 px-2 py-0.5 text-white/95">N {neutral}%</span>
            <span className="rounded-full bg-black/15 px-2 py-0.5 text-white/95">Neg {negative}%</span>
          </div>
        </div>
      )}
      <div className="mt-3 flex h-8 items-end gap-1.5">
        {sparkline.map((point, i) => (
          <div
            key={`${title}-${i}`}
            className="flex-1 rounded-sm bg-gradient-to-b from-slate-100/70 to-slate-50/50 backdrop-blur-sm p-[1.5px] transition-all duration-200"
            style={{
              opacity: i > sparkline.length - 3 ? 1 : 0.6,
            }}
          >
            <div
              className="rounded-[2px] w-full"
              style={{
                height: `${Math.max(6, point / 2)}px`,
                background: sparkColor,
                boxShadow: `0 0 8px ${sparkColor}50`,
              }}
            />
          </div>
        ))}
      </div>
      {change && (
        <div className={cn(
          "mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
          changeType === "positive" && "text-nucleus-positive",
          changeType === "negative" && "text-nucleus-negative",
          changeType === "neutral" && "text-nucleus-neutral",
          changeType === "positive" && "bg-nucleus-positive/10",
          changeType === "negative" && "bg-nucleus-negative/10",
          changeType === "neutral" && "bg-accent/10",
        )}>
          {change}
        </div>
      )}
    </div>
  );
}
