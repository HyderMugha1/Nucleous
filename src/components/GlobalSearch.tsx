import { useState, useRef, useEffect } from "react";
import { Search, TrendingUp, User, Hash } from "lucide-react";

const suggestions = [
  { icon: TrendingUp, label: "Imran Khan sentiment analysis", type: "Trending" },
  { icon: Hash, label: "Pepsi campaign reaction", type: "Topic" },
  { icon: User, label: "HBL brand mentions", type: "Entity" },
  { icon: TrendingUp, label: "PSX market coverage", type: "Trending" },
  { icon: Hash, label: "CPEC latest narrative", type: "Topic" },
];

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query
    ? suggestions.filter(s => s.label.toLowerCase().includes(query.toLowerCase()))
    : suggestions;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (label: string) => {
    setQuery(label);
    setFocused(false);
  };

  return (
    <div className="relative" ref={ref}>
      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder="Search insights, entities, trends..."
        className="h-11 w-full rounded-2xl border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(247,242,236,0.9))] pl-11 pr-20 text-sm text-foreground shadow-[0_16px_36px_-28px_rgba(15,23,42,0.45)] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/45 focus:border-primary/40 transition-all"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-white/80 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
        Cmd/Ctrl K
      </span>
      {focused && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[1.3rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,242,236,0.95))] shadow-[0_28px_70px_-36px_rgba(15,23,42,0.34)] animate-scale-in">
          {filtered.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSelect(s.label)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-foreground/80 transition-colors hover:bg-primary/6 hover:text-foreground"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white/85">
                <s.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
              </span>
              <span className="flex-1 truncate">
                {query ? (
                  <>
                    {s.label.split(new RegExp(`(${query})`, 'gi')).map((part, j) =>
                      part.toLowerCase() === query.toLowerCase()
                        ? <mark key={j} className="rounded px-0.5 bg-primary/15 text-primary">{part}</mark>
                        : part
                    )}
                  </>
                ) : s.label}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{s.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
