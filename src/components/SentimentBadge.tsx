import { cn } from "@/lib/utils";

interface SentimentBadgeProps {
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  score?: number;
  className?: string;
}

export function SentimentBadge({ sentiment, score, className }: SentimentBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
      sentiment === "positive" && "bg-nucleus-positive/15 text-nucleus-positive",
      sentiment === "negative" && "bg-nucleus-negative/15 text-nucleus-negative",
      sentiment === "neutral" && "bg-nucleus-neutral/15 text-nucleus-neutral",
      sentiment === "mixed" && "bg-nucleus-info/15 text-nucleus-info",
      className
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        sentiment === "positive" && "bg-nucleus-positive",
        sentiment === "negative" && "bg-nucleus-negative",
        sentiment === "neutral" && "bg-nucleus-neutral",
        sentiment === "mixed" && "bg-nucleus-info",
      )} />
      {sentiment}
      {score !== undefined && <span className="font-mono text-[10px] opacity-70 normal-case tracking-normal">{score}%</span>}
    </span>
  );
}
