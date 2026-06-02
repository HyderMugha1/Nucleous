import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const platforms = ["All", "Facebook", "Twitter/X", "Instagram", "YouTube", "LinkedIn", "TikTok", "Reddit", "News Sites"];
const contentTypes = ["Posts", "Videos", "Images", "Links", "Articles", "Comments"];
const sentiments = ["All", "Positive", "Neutral", "Negative"];
const languages = ["English", "Urdu", "Hindi", "Arabic", "Spanish", "French", "German", "Chinese", "Japanese", "Portuguese"];

interface AdvancedFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FilterSection({ title, options, selected, onToggle }: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (opt: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                active
                  ? "bg-primary/15 text-primary border border-primary/30 glow-primary-sm"
                  : "bg-muted/50 text-muted-foreground border border-border hover:bg-muted hover:text-foreground hover:border-primary/20"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AdvancedFilters({ open, onOpenChange }: AdvancedFiltersProps) {
  const [selPlatforms, setSelPlatforms] = useState<string[]>(["All"]);
  const [selContent, setSelContent] = useState<string[]>([]);
  const [selSentiment, setSelSentiment] = useState<string[]>(["All"]);
  const [selLanguages, setSelLanguages] = useState<string[]>(["English"]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  const clearAll = () => {
    setSelPlatforms(["All"]);
    setSelContent([]);
    setSelSentiment(["All"]);
    setSelLanguages(["English"]);
    setDateFrom("");
    setDateTo("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md glass-strong border-border/50 overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border/50">
          <SheetTitle className="text-foreground flex items-center justify-between">
            Advanced Filters
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <FilterSection title="Platform / Source" options={platforms} selected={selPlatforms} onToggle={(v) => toggle(selPlatforms, setSelPlatforms, v)} />
          <FilterSection title="Content Type" options={contentTypes} selected={selContent} onToggle={(v) => toggle(selContent, setSelContent, v)} />
          <FilterSection title="Sentiment" options={sentiments} selected={selSentiment} onToggle={(v) => toggle(selSentiment, setSelSentiment, v)} />
          <FilterSection title="Language" options={languages} selected={selLanguages} onToggle={(v) => toggle(selLanguages, setSelLanguages, v)} />

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date Range</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full h-9 rounded-lg bg-muted/50 border border-border px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="w-full h-9 rounded-lg bg-muted/50 border border-border px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border/50">
          <Button variant="outline" className="flex-1" onClick={clearAll}>Clear All</Button>
          <Button className="flex-1 gradient-primary text-primary-foreground animate-glow-pulse" onClick={() => onOpenChange(false)}>
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
