import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, ExternalLink, Search, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getMediaBrandMonitor,
  getMediaIntelligenceTrends,
  searchMediaIntelligence,
  type MediaBrandMonitorResponse,
  type MediaKeywordSearchResponse,
  type MediaTrendResponse,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoString(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export function MediaIntelligencePanel({
  defaultSource,
}: {
  defaultSource: "all" | "tv" | "news" | "epaper";
}) {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(daysAgoString(7));
  const [to, setTo] = useState(todayString());
  const [searchResult, setSearchResult] = useState<MediaKeywordSearchResponse | null>(null);
  const [trends, setTrends] = useState<MediaTrendResponse | null>(null);
  const [brandMonitor, setBrandMonitor] = useState<MediaBrandMonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      getMediaIntelligenceTrends({ source: defaultSource, from, to }),
      getMediaBrandMonitor({ from, to }),
    ])
      .then(([trendResponse, brandResponse]) => {
        if (!active) return;
        setTrends(trendResponse);
        setBrandMonitor(brandResponse);
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Unable to load media intelligence",
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
  }, [defaultSource, from, to]);

  const runSearch = async () => {
    if (!query.trim()) {
      setSearchResult(null);
      return;
    }
    try {
      setSearchLoading(true);
      const response = await searchMediaIntelligence({
        query: query.trim(),
        source: defaultSource,
        from,
        to,
      });
      setSearchResult(response);
    } catch (error) {
      toast({
        title: "Unable to search media intelligence",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const trendChartData = useMemo(() => {
    return (trends?.trending || []).slice(0, 5).map((item) => ({
      keyword: item.keyword,
      count: item.totalOccurrences,
      spike: Number(item.spikeRatio.toFixed(2)),
    }));
  }, [trends]);

  const searchTrendData = searchResult?.trend || [];
  const competitorHighlights = brandMonitor?.competitors || [];
  const brandHighlights = brandMonitor?.brand || [];

  return (
    <div className="glass-premium rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Media Intelligence</h2>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(2,auto)_auto]">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search keyword or phrase across TV and news" />
        <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Button onClick={() => void runSearch()} disabled={searchLoading}>
          <Search className="h-4 w-4" />
          Search
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Brand Mentions</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{loading ? "..." : brandMonitor?.summary.brandMentionCount || 0}</p>
            <p className="mt-1 text-sm text-muted-foreground">Your organization mentions in the selected range</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Competitor Mentions</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{loading ? "..." : brandMonitor?.summary.competitorMentionCount || 0}</p>
            <p className="mt-1 text-sm text-muted-foreground">Tracked competitor mentions in the selected range</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Top Competitor Signals</p>
            {competitorHighlights.length > 0 ? (
              competitorHighlights.slice(0, 4).map((item) => (
                <div key={item.keyword} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-foreground">{item.keyword}</span>
                  <span className="font-mono text-primary">{item.totalOccurrences}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No competitor spikes detected yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Trending Keywords</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendChartData}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} strokeDasharray="4 6" />
                <XAxis dataKey="keyword" tickLine={false} axisLine={false} stroke="#64748b" fontSize={10} />
                <YAxis tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Brand Trend Leaders</p>
            {brandHighlights.length > 0 ? (
              brandHighlights.slice(0, 4).map((item) => (
                <div key={item.keyword} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="inline-flex items-center gap-2 text-foreground">
                    <Building2 className="h-4 w-4 text-primary" />
                    {item.keyword}
                  </span>
                  <span className="font-mono text-primary">{item.totalOccurrences}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No brand signals detected yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Keyword Search Results</p>
            <p className="text-xs text-muted-foreground">
              {searchResult ? `${searchResult.totalOccurrences} occurrences across ${searchResult.totalResults} matched records` : "Search any phrase to inspect exact matches and timestamps."}
            </p>
          </div>
          {searchResult?.message && <span className="text-xs text-muted-foreground">{searchResult.message}</span>}
        </div>

        {searchTrendData.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={searchTrendData}>
              <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} strokeDasharray="4 6" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} stroke="#64748b" fontSize={10} />
              <YAxis tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="occurrences" stroke="#24c7d9" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {searchLoading && <p className="text-sm text-muted-foreground">Searching media intelligence...</p>}
        {!searchLoading && searchResult?.items?.length ? (
          <div className="space-y-3">
            {searchResult.items.slice(0, 8).map((item) => (
              <div key={`${item.sourceKind}-${item.title}-${item.redirectUrl || item.sourceName}`} className="rounded-lg border border-border/30 bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.sourceName} | {item.sourceKind}</p>
                  </div>
                  <span className="font-mono text-sm text-primary">{item.totalOccurrences}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {item.snippets.slice(0, 2).map((snippet, index) => (
                    <p key={`${item.title}-snippet-${index}`} className="line-clamp-2 text-sm text-muted-foreground">{snippet}</p>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">
                    {item.timestamps.length > 0 ? `Timestamps: ${item.timestamps.slice(0, 5).map((stamp) => `${Math.floor(stamp)}s`).join(", ")}` : "Published content match"}
                  </span>
                  {item.redirectUrl && (
                    <a href={item.redirectUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      Open Source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : !searchLoading ? (
          <p className="text-sm text-muted-foreground">No search results yet.</p>
        ) : null}
      </div>
    </div>
  );
}
