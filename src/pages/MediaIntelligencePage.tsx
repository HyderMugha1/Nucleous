import { useEffect, useMemo, useState } from "react";
import { BellRing, Eye, Radar, Tv, Newspaper } from "lucide-react";
import { MediaIntelligencePanel } from "@/components/MediaIntelligencePanel";
import { PageVisualDeck } from "@/components/PageVisualDeck";
import { WebPaperCrawlerPanel } from "@/components/news/WebPaperCrawlerPanel";
import { getAlerts, getMediaBrandMonitor, getMediaIntelligenceTrends, type AlertRecord, type MediaBrandMonitorResponse, type MediaTrendResponse } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export default function MediaIntelligencePage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [trends, setTrends] = useState<MediaTrendResponse | null>(null);
  const [brandMonitor, setBrandMonitor] = useState<MediaBrandMonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([
      getAlerts(),
      getMediaIntelligenceTrends({ source: "all" }),
      getMediaBrandMonitor(),
    ])
      .then(([alertsResponse, trendsResponse, brandResponse]) => {
        if (!active) return;
        setAlerts(alertsResponse.items.filter((item) => item.type === "media_keyword_spike").slice(0, 8));
        setTrends(trendsResponse);
        setBrandMonitor(brandResponse);
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Unable to load media intelligence workspace",
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
  }, []);

  const totalBrandMentions = brandMonitor?.summary.brandMentionCount || 0;
  const totalCompetitorMentions = brandMonitor?.summary.competitorMentionCount || 0;
  const trendingKeywords = useMemo(() => trends?.trending || [], [trends]);

  const deckValues = useMemo(() => {
    const totals = trendingKeywords.slice(0, 7).map((item) => item.totalOccurrences);
    return totals.length > 0 ? totals : [0, 0, 0, 0];
  }, [trendingKeywords]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Radar className="h-6 w-6 text-primary" />
          Media Intelligence
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Unified keyword, brand, competitor, TV, and news intelligence for the current workspace.
        </p>
      </div>

      <PageVisualDeck
        eyebrow="Cross-Media Signals"
        title="Brand pressure, competitor movement, and topic acceleration"
        description="This workspace combines TV transcripts, news coverage, and tracked keywords into one live operating layer."
        cards={[
          {
            kind: "line",
            title: "Brand Mentions",
            value: String(totalBrandMentions),
            subtitle: "Current range total",
            footer: "Brand coverage footprint",
            color: "#24c7d9",
            fill: "rgba(36, 199, 217, 0.16)",
            values: deckValues,
          },
          {
            kind: "bar",
            title: "Competitor Pressure",
            value: String(totalCompetitorMentions),
            subtitle: "Current range total",
            footer: "Competitive signal volume",
            color: "#8b5cf6",
            values: deckValues,
          },
          {
            kind: "radial",
            title: "Spike Alerts",
            value: String(alerts.length),
            subtitle: "Recent keyword spikes",
            footer: "Alerting signal count",
            color: "#f97360",
            progress: Math.min(100, alerts.length * 12),
          },
        ]}
      />

      <MediaIntelligencePanel defaultSource="all" />

      <div className="space-y-4">
        <div className="glass-premium rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Branding Monitor</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Review ad visibility, sponsored placements, and brand screenshots for connected news websites from the Media Intelligence workspace. Open a website and switch to its <span className="font-medium text-foreground">Branding</span> tab to run scans, manage labels, schedule monitoring, and export evidence.
          </p>
        </div>

        <WebPaperCrawlerPanel initialTab="websites" mode="branding" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-premium rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Recent Keyword Spike Alerts</h2>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading keyword spike alerts...</p>
          ) : alerts.length > 0 ? (
            alerts.map((alert) => (
              <div key={alert._id} className="rounded-xl border border-border/40 bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{alert.message}</p>
                  <span className="rounded-full border border-border/40 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">
                    {alert.severity}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{new Date(alert.triggeredAt).toLocaleString()}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No recent keyword spikes were found for this workspace.</p>
          )}
        </div>

        <div className="glass-premium rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Coverage Focus</h2>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Tv className="h-4 w-4 text-primary" />
              TV Transcript Monitoring
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Search time-coded transcript matches, investigate exact video moments, and validate broadcast-level spikes.
            </p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Newspaper className="h-4 w-4 text-primary" />
              News and E-Paper Coverage
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Track publisher-level coverage, recurring narratives, and competitor share of voice across text channels.
            </p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-sm font-semibold text-foreground">Trending Keywords</p>
            {trendingKeywords.length > 0 ? (
              <div className="mt-3 space-y-2">
                {trendingKeywords.slice(0, 5).map((item) => (
                  <div key={item.keyword} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{item.keyword}</span>
                    <span className="font-mono text-primary">{item.totalOccurrences}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No trending keywords detected yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
