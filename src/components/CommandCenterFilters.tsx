import { useState } from "react";
import { CalendarIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { MultiSelectChips } from "@/components/MultiSelectChips";

const insightTypes = ["Daily", "Weekly", "Monthly", "Yearly"];
const competitors = ["Jazz", "Zong", "Telenor", "Ufone"];
const platforms = ["Twitter/X", "Facebook", "Instagram", "LinkedIn", "TikTok", "YouTube", "News", "TV"];

export function CommandCenterFilters() {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [insightType, setInsightType] = useState("Daily");
  const [mode, setMode] = useState<"brand" | "competitor">("brand");
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const reset = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setInsightType("Daily");
    setMode("brand");
    setSelectedCompetitors([]);
    setSelectedPlatforms([]);
  };

  return (
    <div className="sticky top-0 z-20 -mx-6 mb-2 border-b border-border/30 bg-[linear-gradient(180deg,rgba(255,252,248,0.94),rgba(247,241,234,0.88))] px-6 py-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3">
        {/* Date Range */}
        <div className="flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-9 gap-1.5 text-xs", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-3 w-3" />
                {dateFrom ? format(dateFrom, "MMM d") : "Start"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-xs">→</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-9 gap-1.5 text-xs", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3 w-3" />
                {dateTo ? format(dateTo, "MMM d") : "End"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border/30" />

        {/* Insight Type */}
        <div className="flex rounded-2xl border border-white/70 bg-white/60 p-1 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.35)]">
          {insightTypes.map((t) => (
            <button
              key={t}
              onClick={() => setInsightType(t)}
              className={cn(
                "rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200",
                insightType === t
                  ? "bg-primary/12 text-primary shadow-[0_12px_26px_-20px_rgba(249,115,96,0.42)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-border/30" />

        {/* Mode */}
        <div className="flex rounded-2xl border border-white/70 bg-white/60 p-1 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.35)]">
          <button
            onClick={() => setMode("brand")}
            className={cn("rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200", mode === "brand" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            All Brand Insights
          </button>
          <button
            onClick={() => setMode("competitor")}
            className={cn("rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200", mode === "competitor" ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            Competitor Analysis
          </button>
        </div>

        {/* Competitor Dropdown */}
        {mode === "competitor" && (
          <MultiSelectChips
            label="Competitors"
            options={competitors}
            selected={selectedCompetitors}
            onChange={setSelectedCompetitors}
            allowSelectAll
            searchable
          />
        )}

        <MultiSelectChips
          label="Platforms"
          options={platforms}
          selected={selectedPlatforms}
          onChange={setSelectedPlatforms}
          allowSelectAll
          searchable
        />

        <div className="flex-1" />

        {/* Actions */}
        <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={reset}>
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
        <Button size="sm" className="h-9 text-xs animate-glow-pulse">
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
