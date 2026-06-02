import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  createWebPaperWebsite,
  deleteWebPaperArticle,
  deleteWebPaperWebsite,
  getWebPaperArticle,
  getWebPaperArticles,
  getWebPaperCrawlerLogs,
  getWebPaperCrawlerSettings,
  getWebPaperCrawlerStatus,
  getWebPaperWebsites,
  runWebPaperBackfillLastMonth,
  runWebPaperCrawlerNow,
  runWebPaperWebsite,
  updateWebPaperCrawlerSettings,
  updateWebPaperWebsite,
  type WebPaperArticleRecord,
  type WebPaperCrawlerLogRecord,
  type WebPaperCrawlerSettingsRecord,
  type WebPaperCrawlerStatusResponse,
  type WebPaperWebsiteRecord,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, ExternalLink, Globe, Play, RefreshCcw, Search, Settings2, Trash2 } from "lucide-react";

function formatDateTime(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="glass-premium rounded-2xl p-4">
      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

const defaultCrawlerStatus: WebPaperCrawlerStatusResponse = {
  settings: {
    id: "default",
    crawler_enabled: true,
    crawl_interval_minutes: 15,
    request_timeout_seconds: 30,
    max_retries: 3,
    delay_between_requests_seconds: 2,
    max_articles_per_crawl: 50,
    save_raw_html: false,
    initial_backfill_enabled: true,
    created_at: "",
    updated_at: "",
  },
  summary: {
    totalArticles: 0,
    articlesFetchedToday: 0,
    activeWebsites: 0,
    lastCrawlTime: null,
    failedCrawls: 0,
  },
  websites: [],
};

const emptyWebsiteForm = {
  name: "",
  baseUrl: "",
  domain: "",
  scraperKey: "dawn",
  crawlIntervalMinutes: 15,
  isActive: true,
};

export function WebPaperCrawlerPanel() {
  const { user } = useAuth();
  const [status, setStatus] = useState<WebPaperCrawlerStatusResponse>(defaultCrawlerStatus);
  const [settings, setSettings] = useState<WebPaperCrawlerSettingsRecord | null>(null);
  const [websites, setWebsites] = useState<WebPaperWebsiteRecord[]>([]);
  const [availableScrapers, setAvailableScrapers] = useState<string[]>([]);
  const [articles, setArticles] = useState<WebPaperArticleRecord[]>([]);
  const [articlePagination, setArticlePagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [logs, setLogs] = useState<WebPaperCrawlerLogRecord[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<WebPaperArticleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [articleFilters, setArticleFilters] = useState({
    search: "",
    websiteId: "all",
    dateFrom: "",
    dateTo: "",
    category: "",
    status: "all",
    source: "",
  });
  const [websiteForm, setWebsiteForm] = useState(emptyWebsiteForm);

  const categories = useMemo(() => {
    return Array.from(new Set(articles.map((item) => item.category).filter((item): item is string => Boolean(item)))).sort();
  }, [articles]);

  const loadArticles = useCallback(async (page = 1) => {
    const response = await getWebPaperArticles({
      page,
      limit: articlePagination.limit,
      search: articleFilters.search || undefined,
      websiteId: articleFilters.websiteId !== "all" ? articleFilters.websiteId : undefined,
      dateFrom: articleFilters.dateFrom || undefined,
      dateTo: articleFilters.dateTo || undefined,
      category: articleFilters.category || undefined,
      status: articleFilters.status !== "all" ? articleFilters.status : undefined,
      source: articleFilters.source || undefined,
    });
    setArticles(response.items);
    setArticlePagination(response.pagination);
  }, [articleFilters.category, articleFilters.dateFrom, articleFilters.dateTo, articleFilters.search, articleFilters.source, articleFilters.status, articleFilters.websiteId, articlePagination.limit]);

  const loadLogs = useCallback(async () => {
    const response = await getWebPaperCrawlerLogs({ page: 1, limit: 20 });
    setLogs(response.items);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusCoreResult, websitesCoreResult, settingsCoreResult, articlesResult, logsResult] = await Promise.allSettled([
        getWebPaperCrawlerStatus(),
        getWebPaperWebsites(),
        getWebPaperCrawlerSettings(),
        loadArticles(1),
        loadLogs(),
      ]);

      if (statusCoreResult.status === "fulfilled") {
        setStatus(statusCoreResult.value);
      } else {
        setStatus(defaultCrawlerStatus);
      }

      if (websitesCoreResult.status === "fulfilled") {
        setWebsites(websitesCoreResult.value.items);
        setAvailableScrapers(websitesCoreResult.value.availableScrapers);
      } else {
        setWebsites([]);
        setAvailableScrapers(["tribune", "dawn", "geo", "ary", "express"]);
      }

      if (settingsCoreResult.status === "fulfilled") {
        setSettings(settingsCoreResult.value.item);
      } else {
        setSettings(defaultCrawlerStatus.settings);
      }

      if (articlesResult.status === "rejected") {
        setArticles([]);
      }

      if (logsResult.status === "rejected") {
        setLogs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [loadArticles, loadLogs]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshAll();
    }, 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshAll]);

  useEffect(() => {
    if (loading) return;
    void loadArticles(1).catch((error) => {
      setArticles([]);
    });
  }, [articleFilters.category, articleFilters.dateFrom, articleFilters.dateTo, articleFilters.search, articleFilters.source, articleFilters.status, articleFilters.websiteId, loadArticles, loading]);

  async function runAction(key: string, action: () => Promise<void>, successMessage: string) {
    setBusyAction(key);
    try {
      await action();
      toast({ title: successMessage });
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }

    try {
      await refreshAll();
    } catch {
      // Keep the primary action result separate from a follow-up refresh failure.
    }
  }

  async function handleOpenArticle(id: string) {
    try {
      const response = await getWebPaperArticle(id);
      setSelectedArticle(response.item);
    } catch (error) {
      toast({
        title: "Unable to load article details",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  if (loading && !settings && websites.length === 0 && status.summary.activeWebsites === 0) {
    return <div className="glass-premium rounded-2xl p-5 text-sm text-muted-foreground">Loading Web Paper crawler...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Web Paper Crawler
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">Automated website crawling, last-month backfill, and article administration for the Web Paper module.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void runAction("refresh", refreshAll, "Web Paper data refreshed")} disabled={Boolean(busyAction)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => void runAction("crawl-now", async () => { await runWebPaperCrawlerNow(); }, "Scheduled crawl triggered")} disabled={Boolean(busyAction)}>
            <Play className="mr-2 h-4 w-4" />
            Manual Crawl Now
          </Button>
          <Button
            variant="secondary"
            onClick={() => void runAction("backfill", async () => { await runWebPaperBackfillLastMonth(); }, "Last complete month backfill started")}
            disabled={Boolean(busyAction)}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Run Last Month Backfill
          </Button>
        </div>
      </div>

      <div className="glass-premium rounded-2xl p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Active Workspace</div>
            <div className="mt-1 text-sm font-medium text-foreground">{user?.company || "Unknown workspace"}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{status.summary.totalArticles}</span> Web Paper articles in this workspace
            {user?.organizationId ? ` • Org ${user.organizationId}` : ""}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Articles" value={String(status?.summary.totalArticles || 0)} note="Saved in Web Paper storage" />
        <SummaryCard label="Fetched Today" value={String(status?.summary.articlesFetchedToday || 0)} note="Articles ingested today" />
        <SummaryCard label="Active Websites" value={String(status?.summary.activeWebsites || 0)} note="Publishers currently enabled" />
        <SummaryCard label="Last Crawl" value={status?.summary.lastCrawlTime ? formatDateTime(status.summary.lastCrawlTime) : "Never"} note="Most recent crawl completion" />
        <SummaryCard label="Failed Crawls" value={String(status?.summary.failedCrawls || 0)} note="Failed or partial crawl logs" />
      </div>

      <Tabs defaultValue="articles" className="space-y-5">
        <TabsList className="bg-muted/30 border border-border/30 h-10 p-0.5">
          <TabsTrigger value="articles">Articles</TabsTrigger>
          <TabsTrigger value="websites">Websites</TabsTrigger>
          <TabsTrigger value="logs">Crawl Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-4">
          <div className="glass-premium rounded-2xl p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={articleFilters.search}
                  onChange={(event) => setArticleFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Search title or content"
                  className="pl-10"
                />
              </div>
              <Select value={articleFilters.websiteId} onValueChange={(value) => setArticleFilters((current) => ({ ...current, websiteId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All websites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All websites</SelectItem>
                  {websites.map((website) => (
                    <SelectItem key={website.id} value={website.id}>{website.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={articleFilters.dateFrom} onChange={(event) => setArticleFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
              <Input type="date" value={articleFilters.dateTo} onChange={(event) => setArticleFilters((current) => ({ ...current, dateTo: event.target.value }))} />
              <Select value={articleFilters.status} onValueChange={(value) => setArticleFilters((current) => ({ ...current, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
              <Select value={articleFilters.category || "all"} onValueChange={(value) => setArticleFilters((current) => ({ ...current, category: value === "all" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="glass-premium rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Fetched</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      {status.summary.totalArticles === 0
                        ? `No Web Paper articles are saved for ${user?.company || "this workspace"} yet.`
                        : "No Web Paper articles match the current filters."}
                    </TableCell>
                  </TableRow>
                )}
                {articles.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="max-w-[360px]">
                      <div className="font-medium text-foreground">{article.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.excerpt || article.content || "No summary available."}</div>
                    </TableCell>
                    <TableCell>{article.source_name}</TableCell>
                    <TableCell>{article.category || "Uncategorized"}</TableCell>
                    <TableCell>{formatDateTime(article.published_at)}</TableCell>
                    <TableCell>{formatDateTime(article.fetched_at)}</TableCell>
                    <TableCell><Badge variant="outline">{article.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => void handleOpenArticle(article.id)}>View Details</Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={article.url} target="_blank" rel="noreferrer">
                            Open
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void runAction(`delete-article-${article.id}`, async () => { await deleteWebPaperArticle(article.id); }, "Article deleted")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{articlePagination.total} articles</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={articlePagination.page <= 1} onClick={() => void loadArticles(articlePagination.page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={articlePagination.page >= articlePagination.pages} onClick={() => void loadArticles(articlePagination.page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="websites" className="space-y-4">
          <div className="glass-premium rounded-2xl p-4 space-y-4">
            <div className="text-sm font-medium text-foreground">Add Website</div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
              <Input value={websiteForm.name} onChange={(event) => setWebsiteForm((current) => ({ ...current, name: event.target.value }))} placeholder="Website name" />
              <Input value={websiteForm.baseUrl} onChange={(event) => setWebsiteForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="Base URL" />
              <Input value={websiteForm.domain} onChange={(event) => setWebsiteForm((current) => ({ ...current, domain: event.target.value }))} placeholder="Domain" />
              <Select value={websiteForm.scraperKey} onValueChange={(value) => setWebsiteForm((current) => ({ ...current, scraperKey: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableScrapers.map((scraper) => (
                    <SelectItem key={scraper} value={scraper}>{scraper}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={5}
                value={websiteForm.crawlIntervalMinutes}
                onChange={(event) => setWebsiteForm((current) => ({ ...current, crawlIntervalMinutes: Number(event.target.value || 15) }))}
                placeholder="Interval"
              />
              <Button
                onClick={() => void runAction("create-website", async () => {
                  await createWebPaperWebsite(websiteForm);
                  setWebsiteForm(emptyWebsiteForm);
                }, "Website created")}
              >
                Add Website
              </Button>
            </div>
          </div>

          <div className="glass-premium rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Website</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Last Crawled</TableHead>
                  <TableHead>Backfill</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {websites.map((website) => (
                  <TableRow key={website.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{website.name}</div>
                      <div className="text-xs text-muted-foreground">{website.scraper_key}</div>
                    </TableCell>
                    <TableCell>{website.base_url}</TableCell>
                    <TableCell>
                      <Switch
                        checked={website.is_active}
                        onCheckedChange={(checked) => void runAction(`toggle-${website.id}`, async () => {
                          await updateWebPaperWebsite(website.id, { isActive: checked });
                        }, checked ? "Website enabled" : "Website disabled")}
                      />
                    </TableCell>
                    <TableCell>{website.crawl_interval_minutes} min</TableCell>
                    <TableCell>{formatDateTime(website.last_crawled_at)}</TableCell>
                    <TableCell>
                      <Badge variant={website.is_backfill_completed ? "default" : "outline"}>
                        {website.is_backfill_completed ? "Completed" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => void runAction(`crawl-${website.id}`, async () => { await runWebPaperWebsite(website.id); }, `${website.name} crawl started`)}>
                          Run Now
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void runAction(`delete-website-${website.id}`, async () => { await deleteWebPaperWebsite(website.id); }, "Website deleted")}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="glass-premium rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Website</TableHead>
                  <TableHead>Job Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Found</TableHead>
                  <TableHead>Saved</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Finished</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No crawl logs yet.</TableCell>
                  </TableRow>
                )}
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>{log.web_paper_websites?.name || "All websites"}</div>
                      {log.message && <div className="mt-1 max-w-[260px] text-xs text-muted-foreground">{log.message}</div>}
                    </TableCell>
                    <TableCell>{log.job_type}</TableCell>
                    <TableCell><Badge variant="outline">{log.status}</Badge></TableCell>
                    <TableCell>{log.articles_found}</TableCell>
                    <TableCell>{log.articles_saved}</TableCell>
                    <TableCell>{log.errors_count}</TableCell>
                    <TableCell>{formatDateTime(log.started_at)}</TableCell>
                    <TableCell>{formatDateTime(log.finished_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="glass-premium rounded-2xl p-5">
            {!settings ? (
              <div className="text-sm text-muted-foreground">Loading crawler settings...</div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Settings2 className="h-4 w-4 text-primary" />
                  Crawler Settings
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Default Crawl Interval</Label>
                    <Input
                      type="number"
                      value={settings.crawl_interval_minutes}
                      onChange={(event) => setSettings((current) => current ? { ...current, crawl_interval_minutes: Number(event.target.value || 15) } : current)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Articles Per Crawl</Label>
                    <Input
                      type="number"
                      value={settings.max_articles_per_crawl}
                      onChange={(event) => setSettings((current) => current ? { ...current, max_articles_per_crawl: Number(event.target.value || 50) } : current)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Request Timeout Seconds</Label>
                    <Input
                      type="number"
                      value={settings.request_timeout_seconds}
                      onChange={(event) => setSettings((current) => current ? { ...current, request_timeout_seconds: Number(event.target.value || 30) } : current)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Retry Attempts</Label>
                    <Input
                      type="number"
                      value={settings.max_retries}
                      onChange={(event) => setSettings((current) => current ? { ...current, max_retries: Number(event.target.value || 3) } : current)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Delay Between Requests Seconds</Label>
                    <Input
                      type="number"
                      value={settings.delay_between_requests_seconds}
                      onChange={(event) => setSettings((current) => current ? { ...current, delay_between_requests_seconds: Number(event.target.value || 2) } : current)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border/30 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">Crawler Enabled</div>
                      <div className="text-xs text-muted-foreground">Run scheduled crawling every 15 minutes.</div>
                    </div>
                    <Switch checked={settings.crawler_enabled} onCheckedChange={(checked) => setSettings((current) => current ? { ...current, crawler_enabled: checked } : current)} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border/30 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">Save Raw HTML</div>
                      <div className="text-xs text-muted-foreground">Store article HTML for debugging.</div>
                    </div>
                    <Switch checked={settings.save_raw_html} onCheckedChange={(checked) => setSettings((current) => current ? { ...current, save_raw_html: checked } : current)} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border/30 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">Initial Backfill Enabled</div>
                      <div className="text-xs text-muted-foreground">Auto-run last complete month when needed.</div>
                    </div>
                    <Switch checked={settings.initial_backfill_enabled} onCheckedChange={(checked) => setSettings((current) => current ? { ...current, initial_backfill_enabled: checked } : current)} />
                  </div>
                </div>
                <Button
                  onClick={() => void runAction("save-settings", async () => {
                    await updateWebPaperCrawlerSettings({
                      crawler_enabled: settings.crawler_enabled,
                      crawl_interval_minutes: settings.crawl_interval_minutes,
                      request_timeout_seconds: settings.request_timeout_seconds,
                      max_retries: settings.max_retries,
                      delay_between_requests_seconds: settings.delay_between_requests_seconds,
                      max_articles_per_crawl: settings.max_articles_per_crawl,
                      save_raw_html: settings.save_raw_html,
                      initial_backfill_enabled: settings.initial_backfill_enabled,
                    });
                  }, "Crawler settings updated")}
                >
                  Save Settings
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selectedArticle)} onOpenChange={(open) => { if (!open) setSelectedArticle(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedArticle?.title}</DialogTitle>
          </DialogHeader>
          {selectedArticle && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{selectedArticle.source_name}</Badge>
                <span>{formatDateTime(selectedArticle.published_at)}</span>
                {selectedArticle.category && <span>{selectedArticle.category}</span>}
                {selectedArticle.author && <span>{selectedArticle.author}</span>}
              </div>
              <Textarea value={selectedArticle.content || selectedArticle.excerpt || ""} readOnly className="min-h-[320px]" />
              <div className="flex justify-end">
                <Button variant="outline" asChild>
                  <a href={selectedArticle.url} target="_blank" rel="noreferrer">
                    Open Original
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
