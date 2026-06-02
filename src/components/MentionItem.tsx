import { SentimentBadge } from "@/components/SentimentBadge";
import { cn } from "@/lib/utils";

interface MentionItemProps {
  title: string;
  source: string;
  sourceType: string;
  timestamp: string;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  sentimentScore: number;
  entities: string[];
  snippet: string;
  language: "en" | "ur" | "rur";
}

const langLabels = { en: "EN", ur: "اردو", rur: "Roman Ur" };

export function MentionItem({ title, source, sourceType, timestamp, sentiment, sentimentScore, entities, snippet, language }: MentionItemProps) {
  const sentimentFill = Math.min(100, Math.max(0, sentimentScore));

  return (
    <div className="glass-premium surface-float rounded-[1.7rem] p-5 hover:border-primary/30 transition-all duration-300 cursor-pointer animate-slide-up group hover:translate-y-[-3px]">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{sourceType}</span>
            <span className="text-[11px] font-medium text-nucleus-text-dim">{source}</span>
            <span className="text-[11px] text-nucleus-text-dim">•</span>
            <span className="text-[11px] text-nucleus-text-dim">{timestamp}</span>
            <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent font-mono">{langLabels[language]}</span>
          </div>
          <h3 className="text-base font-semibold leading-6 text-foreground group-hover:text-primary transition-colors line-clamp-2">{title}</h3>
        </div>
        <SentimentBadge sentiment={sentiment} score={sentimentScore} />
      </div>
      <p className="mb-4 text-sm leading-6 text-muted-foreground line-clamp-3">{snippet}</p>
      <div className="mb-4">
        <div className="h-2 overflow-hidden rounded-full bg-muted/70">
          <div
            className={cn(
              "h-full rounded-full",
              sentiment === "positive" && "bg-nucleus-positive",
              sentiment === "negative" && "bg-nucleus-negative",
              sentiment === "neutral" && "bg-nucleus-neutral",
              sentiment === "mixed" && "bg-primary",
            )}
            style={{ width: `${sentimentFill}%` }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {entities.map((e) => (
          <span key={e} className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">{e}</span>
        ))}
      </div>
    </div>
  );
}
