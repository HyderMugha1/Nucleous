import { PageVisualDeck } from "@/components/PageVisualDeck";
import { MediaIntelligencePanel } from "@/components/MediaIntelligencePanel";
import { WebPaperCrawlerPanel } from "@/components/news/WebPaperCrawlerPanel";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getEPaperClips, getNewsArticles, getWebPaperArticles, type EPaperClipRecord, type WebPaperArticleRecord } from "@/lib/api";
import { Calendar, FileText, Globe, Newspaper, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { toast } from "@/hooks/use-toast";

function formatDay(value?: string | null) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mapLegacyArticleToWebPaper(article: Awaited<ReturnType<typeof getNewsArticles>>["items"][number]): WebPaperArticleRecord {
  return {
    id: article.id,
    website_id: "legacy-news",
    source_name: article.source_name,
    title: article.headline,
    url: article.url || "",
    normalized_url: article.url || article.id,
    excerpt: article.summary,
    content: article.body,
    language: article.language,
    published_at: article.published_at,
    fetched_at: article.created_at,
    status: "published",
    created_at: article.created_at,
  };
}

export default function NewsIntelligence() {
  const { user } = useAuth();
  const [webPaperArticles, setWebPaperArticles] = useState<WebPaperArticleRecord[]>([]);
  const [epaper, setEPaper] = useState<EPaperClipRecord[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("web");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [webPaperResult, epaperResult] = await Promise.allSettled([getWebPaperArticles({ limit: 100 }), getEPaperClips({ limit: 100 })]);

        if (!active) return;

        if (webPaperResult.status === "fulfilled") {
          setWebPaperArticles(webPaperResult.value.items);
        } else {
          try {
            const legacyResponse = await getNewsArticles({ limit: 100 });
            if (!active) return;
            setWebPaperArticles(legacyResponse.items.map(mapLegacyArticleToWebPaper));
          } catch {
            // Keep empty state when neither endpoint is available.
          }
        }

        if (epaperResult.status === "fulfilled") {
          setEPaper(epaperResult.value.items);
        }

        if (webPaperResult.status === "rejected" && epaperResult.status === "rejected") {
          toast({
            title: "Unable to load news intelligence",
            description: "The news API is unavailable right now. Please check that the backend server is running and up to date.",
            variant: "destructive",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const filteredWebPaper = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return webPaperArticles;
    return webPaperArticles.filter((article) => `${article.title} ${article.excerpt || ""} ${article.content || ""} ${article.source_name}`.toLowerCase().includes(query));
  }, [search, webPaperArticles]);

  const filteredEPaper = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return epaper;
    return epaper.filter((clip) => `${clip.headline || ""} ${clip.ocr_text} ${clip.source_name}`.toLowerCase().includes(query));
  }, [epaper, search]);

  const activeRecords = activeTab === "epaper" ? filteredEPaper : filteredWebPaper;

  const trendData = useMemo(() => {
    const buckets = new Map<string, number>();
    activeRecords.forEach((item) => {
      const date = formatDay("published_at" in item ? item.published_at : null);
      buckets.set(date, (buckets.get(date) || 0) + 1);
    });
    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count })).slice(-7);
  }, [activeRecords]);

  const sourceDistribution = useMemo(() => {
    const buckets = new Map<string, number>();
    activeRecords.forEach((item) => {
      buckets.set(item.source_name, (buckets.get(item.source_name) || 0) + 1);
    });
    return Array.from(buckets.entries())
      .map(([sourceName, count]) => ({ sourceName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [activeRecords]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Newspaper className="h-6 w-6 text-primary" />
          Newspaper
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Live web paper crawling and e-paper intelligence from your backend workspace.</p>
      </div>

      <PageVisualDeck
        eyebrow="News Visuals"
        title="Publisher flow, coverage spread, and crawled article volume"
        description="The Web Paper section now includes crawler-driven website ingestion, last-month backfill, and ongoing scheduled checks."
        cards={[
          { kind: "line", title: "Visible Records", value: String(activeRecords.length), subtitle: "Items in the active tab", footer: "Current search scope", color: "#24c7d9", fill: "rgba(36, 199, 217, 0.16)", values: trendData.map((item) => item.count) },
          { kind: "bar", title: "Publisher Spread", value: String(sourceDistribution.length), subtitle: "Top active sources", footer: "Highest-volume publishers", color: "#8b5cf6", values: sourceDistribution.map((item) => item.count) },
          { kind: "radial", title: "Crawler Watch", value: activeTab === "web" ? "Automated" : "Archive", subtitle: activeTab === "web" ? "15 min cadence" : "OCR clips", footer: activeTab === "web" ? "Backfill + recurring crawls" : "Manual and imported clips", color: "#f97360", progress: Math.min(100, activeRecords.length) },
        ]}
      />

      <div className="glass-premium rounded-2xl p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search crawled web articles, e-paper clips, or publishers" className="pl-10" />
        </div>
      </div>

      <MediaIntelligencePanel defaultSource="news" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/30 border border-border/30 h-10 p-0.5">
          <TabsTrigger value="web" className="text-sm data-[state=active]:bg-primary/15 data-[state=active]:text-primary gap-2">
            <Globe className="h-4 w-4" /> Web Paper
          </TabsTrigger>
          <TabsTrigger value="epaper" className="text-sm data-[state=active]:bg-primary/15 data-[state=active]:text-primary gap-2">
            <FileText className="h-4 w-4" /> E-Paper
          </TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="glass-premium rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Volume by Day</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} strokeDasharray="4 6" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
                <YAxis tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#24c7d9" fill="rgba(36, 199, 217, 0.16)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-premium rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Top Publishers</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sourceDistribution}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} strokeDasharray="4 6" />
                <XAxis dataKey="sourceName" tickLine={false} axisLine={false} stroke="#64748b" fontSize={10} />
                <YAxis tickLine={false} axisLine={false} stroke="#64748b" fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <TabsContent value="web" className="space-y-4">
          {loading && <div className="glass-premium rounded-2xl p-5 text-sm text-muted-foreground">Loading Web Paper crawler data...</div>}
          {!loading && filteredWebPaper.length === 0 && (
            <div className="glass-premium rounded-2xl p-5 text-sm text-muted-foreground">
              No crawled web articles are visible for {user?.company || "this workspace"} yet.
              {user?.organizationId ? ` Current org: ${user.organizationId}.` : ""}
            </div>
          )}
          <WebPaperCrawlerPanel />
        </TabsContent>

        <TabsContent value="epaper" className="space-y-4">
          {loading && <div className="glass-premium rounded-2xl p-5 text-sm text-muted-foreground">Loading e-paper clips...</div>}
          {!loading && filteredEPaper.length === 0 && <div className="glass-premium rounded-2xl p-5 text-sm text-muted-foreground">No e-paper clips match the current search.</div>}
          {filteredEPaper.map((clip) => (
            <div key={clip.id} className="glass-premium rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/30 text-muted-foreground">{clip.source_name}</Badge>
                {clip.page_label && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/30 text-muted-foreground">{clip.page_label}</Badge>}
                <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDay(clip.published_at)}</span>
              </div>
              <h3 className="text-lg font-semibold text-foreground">{clip.headline || "Untitled e-paper clip"}</h3>
              <p className="text-sm text-muted-foreground">{clip.ocr_text}</p>
            </div>
          ))}
        </TabsContent>

      </Tabs>
    </div>
  );
}
