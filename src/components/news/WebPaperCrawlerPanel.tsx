import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  createWebPaperWebsite,
  deleteNewsBrandingResult,
  deleteWebPaperArticle,
  deleteWebPaperWebsite,
  downloadNewsBrandingExport,
  getNewsBrandingResults,
  getNewsBrandingScanStatus,
  startNewsBrandingScan,
  stopNewsBrandingScan,
  updateNewsBrandingResult,
  updateNewsBrandingSchedule,
  getWebPaperArticle,
  getWebPaperArticles,
  getWebPaperCrawlerLogs,
  getWebPaperCrawlerSettings,
  getWebPaperCrawlerStatus,
  getWebPaperWebsites,
  runWebPaperBackfillLastMonth,
  runWebPaperCrawlerNow,
  runWebPaperWebsite,
  type BrandingResultRecord,
  type BrandingScanRecord,
  type BrandingScheduleRecord,
  type BrandingSummaryRecord,
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
import {
  Calendar,
  Download,
  ExternalLink,
  Eye,
  Globe,
  LayoutGrid,
  Pencil,
  Play,
  RefreshCcw,
  Search,
  Settings2,
  SquareChartGantt,
  StopCircle,
  Trash2,
} from "lucide-react";

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

const defaultBrandingSummary: BrandingSummaryRecord = {
  totalPagesScanned: 0,
  totalAdsDetected: 0,
  totalUniqueBrands: 0,
  lastScanTime: null,
  mostCommonAdPlacement: "None",
  failedScans: 0,
  averageAdsPerPage: 0,
};

const defaultBrandingFilters = {
  date_from: "",
  date_to: "",
  page_url: "",
  brand_name: "",
  ad_type: "all",
  placement: "all",
  device_type: "all",
  status: "all",
};

const defaultBrandingScheduleDraft = {
  enabled: false,
  frequency: "daily" as "daily" | "weekly" | "monthly",
  time: "09:00",
  device_types: ["desktop"] as string[],
  max_urls_per_scan: 1,
  capture_full_page: true,
  capture_ad_elements: true,
  use_ai_classification: true,
};

function formatShortDateTime(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cleanDisplayText(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function downloadBlobFile(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 500);
}

function extractBrandingScanUrls(items: WebPaperArticleRecord[] = []) {
  const unique = new Set<string>();
  for (const item of items) {
    const candidates = [item.canonical_url, item.normalized_url, item.url];
    for (const candidate of candidates) {
      const value = String(candidate || "").trim();
      if (value) unique.add(value);
    }
  }
  return Array.from(unique);
}

export function WebPaperCrawlerPanel({
  initialTab = "articles",
  mode = "full",
}: {
  initialTab?: "articles" | "websites" | "logs" | "settings";
  mode?: "full" | "branding";
}) {
  const { user } = useAuth();
  const isBrandingOnly = mode === "branding";
  const [status, setStatus] = useState<WebPaperCrawlerStatusResponse>(defaultCrawlerStatus);
  const [settings, setSettings] = useState<WebPaperCrawlerSettingsRecord | null>(null);
  const [websites, setWebsites] = useState<WebPaperWebsiteRecord[]>([]);
  const [availableScrapers, setAvailableScrapers] = useState<string[]>([]);
  const [articles, setArticles] = useState<WebPaperArticleRecord[]>([]);
  const [articlePagination, setArticlePagination] = useState({ page: 1, pages: 1, total: 0, limit: 10 });
  const [logs, setLogs] = useState<WebPaperCrawlerLogRecord[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<WebPaperArticleRecord | null>(null);
  const [selectedWebsite, setSelectedWebsite] = useState<WebPaperWebsiteRecord | null>(null);
  const [websiteWorkspaceTab, setWebsiteWorkspaceTab] = useState("overview");
  const [websiteWorkspaceArticles, setWebsiteWorkspaceArticles] = useState<WebPaperArticleRecord[]>([]);
  const [websiteWorkspaceArticlesLoading, setWebsiteWorkspaceArticlesLoading] = useState(false);
  const [brandingResults, setBrandingResults] = useState<BrandingResultRecord[]>([]);
  const [brandingPagination, setBrandingPagination] = useState({ page: 1, pages: 1, total: 0, limit: 24 });
  const [brandingSummary, setBrandingSummary] = useState<BrandingSummaryRecord>(defaultBrandingSummary);
  const [brandingScans, setBrandingScans] = useState<BrandingScanRecord[]>([]);
  const [brandingSchedule, setBrandingSchedule] = useState<BrandingScheduleRecord | null>(null);
  const [brandingScheduleDraft, setBrandingScheduleDraft] = useState(defaultBrandingScheduleDraft);
  const [brandingFilters, setBrandingFilters] = useState(defaultBrandingFilters);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingBusyAction, setBrandingBusyAction] = useState<string | null>(null);
  const [brandingScanStatus, setBrandingScanStatus] = useState<BrandingScanRecord | null>(null);
  const [brandingScanDeviceTypes, setBrandingScanDeviceTypes] = useState<string[]>(["desktop"]);
  const [previewBrandingResult, setPreviewBrandingResult] = useState<BrandingResultRecord | null>(null);
  const [editingBrandingResult, setEditingBrandingResult] = useState<BrandingResultRecord | null>(null);
  const [brandingEditDraft, setBrandingEditDraft] = useState({
    brand_name: "",
    ad_type: "",
    placement: "",
    is_false_positive: false,
  });
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

  const loadWebsiteWorkspaceArticles = useCallback(async (websiteId: string) => {
    setWebsiteWorkspaceArticlesLoading(true);
    try {
      const response = await getWebPaperArticles({
        page: 1,
        limit: 25,
        websiteId,
      });
      setWebsiteWorkspaceArticles(response.items);
    } finally {
      setWebsiteWorkspaceArticlesLoading(false);
    }
  }, []);

  const loadBrandingResults = useCallback(async (websiteId: string, page = 1) => {
    setBrandingLoading(true);
    try {
      const response = await getNewsBrandingResults(websiteId, {
        ...brandingFilters,
        ad_type: brandingFilters.ad_type !== "all" ? brandingFilters.ad_type : undefined,
        placement: brandingFilters.placement !== "all" ? brandingFilters.placement : undefined,
        device_type: brandingFilters.device_type !== "all" ? brandingFilters.device_type : undefined,
        status: brandingFilters.status !== "all" ? brandingFilters.status : undefined,
        page,
        limit: brandingPagination.limit,
      });
      setBrandingResults(response.results);
      setBrandingPagination(response.pagination);
      setBrandingSummary(response.summary);
      setBrandingScans(response.scans);
      setBrandingSchedule(response.schedule || null);
      setBrandingScheduleDraft(response.schedule ? {
        enabled: response.schedule.enabled,
        frequency: response.schedule.frequency,
        time: response.schedule.time_of_day,
        device_types: response.schedule.device_types,
        max_urls_per_scan: response.schedule.max_urls_per_scan,
        capture_full_page: response.schedule.capture_full_page,
        capture_ad_elements: response.schedule.capture_ad_elements,
        use_ai_classification: response.schedule.use_ai_classification,
      } : defaultBrandingScheduleDraft);
      if (response.schedule?.device_types?.length) {
        setBrandingScanDeviceTypes(response.schedule.device_types);
      }
      const activeScan = response.scans.find((item) => ["queued", "running", "stopping"].includes(item.status)) || null;
      setBrandingScanStatus(activeScan);
    } finally {
      setBrandingLoading(false);
    }
  }, [brandingFilters, brandingPagination.limit]);

  const openWebsiteWorkspace = useCallback(async (website: WebPaperWebsiteRecord) => {
    setSelectedWebsite(website);
    setWebsiteWorkspaceTab(isBrandingOnly ? "branding" : "overview");
    try {
      await Promise.all([
        loadWebsiteWorkspaceArticles(website.id),
        loadBrandingResults(website.id, 1),
      ]);
    } catch (error) {
      toast({
        title: "Unable to load website workspace",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [isBrandingOnly, loadBrandingResults, loadWebsiteWorkspaceArticles]);

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
        const nextWebsites = websitesCoreResult.value.items;
        setWebsites(nextWebsites);
        setAvailableScrapers(websitesCoreResult.value.availableScrapers);
        if (isBrandingOnly && nextWebsites.length > 0) {
          const preferredWebsite = selectedWebsite
            ? nextWebsites.find((item) => item.id === selectedWebsite.id) || nextWebsites[0]
            : nextWebsites[0];
          if (!selectedWebsite || selectedWebsite.id !== preferredWebsite.id) {
            setSelectedWebsite(preferredWebsite);
          }
        }
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
  }, [isBrandingOnly, loadArticles, loadLogs, selectedWebsite]);

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

  useEffect(() => {
    if (!selectedWebsite) return;
    void loadBrandingResults(selectedWebsite.id, 1).catch((error) => {
      toast({
        title: "Unable to load branding results",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    });
  }, [brandingFilters, loadBrandingResults, selectedWebsite]);

  useEffect(() => {
    if (!isBrandingOnly) return;
    if (selectedWebsite || websites.length === 0) return;
    setSelectedWebsite(websites[0]);
  }, [isBrandingOnly, selectedWebsite, websites]);

  useEffect(() => {
    if (!isBrandingOnly || !selectedWebsite) return;
    setWebsiteWorkspaceTab("branding");
    void loadWebsiteWorkspaceArticles(selectedWebsite.id).catch(() => {});
  }, [isBrandingOnly, loadWebsiteWorkspaceArticles, selectedWebsite]);

  useEffect(() => {
    if (!selectedWebsite || !brandingScanStatus || !["queued", "running", "stopping"].includes(brandingScanStatus.status)) return;

    const timer = window.setInterval(() => {
      void getNewsBrandingScanStatus(selectedWebsite.id, brandingScanStatus.id)
        .then((response) => {
          setBrandingScanStatus(response.item);
          if (!["queued", "running", "stopping"].includes(response.item.status)) {
            window.clearInterval(timer);
            void Promise.all([
              loadBrandingResults(selectedWebsite.id, brandingPagination.page),
              loadWebsiteWorkspaceArticles(selectedWebsite.id),
            ]).catch(() => {});
          }
        })
        .catch(() => {});
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [brandingPagination.page, brandingScanStatus, loadBrandingResults, loadWebsiteWorkspaceArticles, selectedWebsite]);

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

  async function runBrandingAction(key: string, action: () => Promise<void>, successMessage?: string) {
    setBrandingBusyAction(key);
    try {
      await action();
      if (successMessage) {
        toast({ title: successMessage });
      }
    } catch (error) {
      toast({
        title: "Branding action failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBrandingBusyAction(null);
    }
  }

  function toggleBrandingDevice(deviceType: string) {
    setBrandingScanDeviceTypes((current) => {
      if (current.includes(deviceType)) {
        return current.length === 1 ? current : current.filter((item) => item !== deviceType);
      }
      return [...current, deviceType];
    });
    setBrandingScheduleDraft((current) => {
      const next = current.device_types.includes(deviceType)
        ? (current.device_types.length === 1 ? current.device_types : current.device_types.filter((item) => item !== deviceType))
        : [...current.device_types, deviceType];
      return { ...current, device_types: next };
    });
  }

  async function handleRunBrandingScan() {
    if (!selectedWebsite) return;
    await runBrandingAction("run-branding-scan", async () => {
      const urls = extractBrandingScanUrls(websiteWorkspaceArticles);
      const response = await startNewsBrandingScan(selectedWebsite.id, {
        urls: urls.length > 0 ? urls : undefined,
        device_types: brandingScanDeviceTypes,
        capture_full_page: true,
        capture_ad_elements: true,
        use_ai_classification: true,
        max_urls_per_scan: brandingScheduleDraft.max_urls_per_scan,
      });
      setBrandingScanStatus(response.item);
      setBrandingScans((current) => [response.item, ...current]);
    }, "Branding scan queued");
  }

  async function handleRunBrandingScanForWebsite(website: WebPaperWebsiteRecord) {
    setSelectedWebsite(website);
    setWebsiteWorkspaceTab("branding");
    await runBrandingAction(`run-branding-scan-${website.id}`, async () => {
      let urls = extractBrandingScanUrls(website.id === selectedWebsite?.id ? websiteWorkspaceArticles : []);
      if (urls.length === 0) {
        const response = await getWebPaperArticles({
          page: 1,
          limit: Math.min(brandingScheduleDraft.max_urls_per_scan, 50),
          websiteId: website.id,
        });
        urls = extractBrandingScanUrls(response.items);
        setWebsiteWorkspaceArticles(response.items);
      }
      const response = await startNewsBrandingScan(website.id, {
        urls: urls.length > 0 ? urls : undefined,
        device_types: brandingScanDeviceTypes,
        capture_full_page: true,
        capture_ad_elements: true,
        use_ai_classification: true,
        max_urls_per_scan: brandingScheduleDraft.max_urls_per_scan,
      });
      setBrandingScanStatus(response.item);
      setBrandingScans((current) => [response.item, ...current]);
      await loadBrandingResults(website.id, 1);
    }, `${website.name} branding bot started`);
  }

  async function handleStopBrandingScan() {
    if (!selectedWebsite || !brandingScanStatus) return;
    await runBrandingAction("stop-branding-scan", async () => {
      const response = await stopNewsBrandingScan(selectedWebsite.id, brandingScanStatus.id);
      setBrandingScanStatus(response.item);
      await loadBrandingResults(selectedWebsite.id, brandingPagination.page);
    }, "Branding scan stop requested");
  }

  async function handleSaveBrandingSchedule() {
    if (!selectedWebsite) return;
    await runBrandingAction("save-branding-schedule", async () => {
      const response = await updateNewsBrandingSchedule(selectedWebsite.id, brandingScheduleDraft);
      setBrandingSchedule(response.item);
      setBrandingScheduleDraft({
        enabled: response.item.enabled,
        frequency: response.item.frequency,
        time: response.item.time_of_day,
        device_types: response.item.device_types,
        max_urls_per_scan: response.item.max_urls_per_scan,
        capture_full_page: response.item.capture_full_page,
        capture_ad_elements: response.item.capture_ad_elements,
        use_ai_classification: response.item.use_ai_classification,
      });
    }, "Branding schedule saved");
  }

  async function handleExportBrandingResults(format: "csv" | "json" | "zip") {
    if (!selectedWebsite) return;
    await runBrandingAction(`export-${format}`, async () => {
      const result = await downloadNewsBrandingExport(selectedWebsite.id, format, {
        ...brandingFilters,
        ad_type: brandingFilters.ad_type !== "all" ? brandingFilters.ad_type : undefined,
        placement: brandingFilters.placement !== "all" ? brandingFilters.placement : undefined,
        device_type: brandingFilters.device_type !== "all" ? brandingFilters.device_type : undefined,
        status: brandingFilters.status !== "all" ? brandingFilters.status : undefined,
      });
      downloadBlobFile(result.blob, result.fileName);
    }, `Branding ${format.toUpperCase()} export downloaded`);
  }

  async function handleDeleteBrandingResult(resultId: string) {
    if (!selectedWebsite) return;
    await runBrandingAction(`delete-branding-${resultId}`, async () => {
      await deleteNewsBrandingResult(selectedWebsite.id, resultId);
      await loadBrandingResults(selectedWebsite.id, brandingPagination.page);
    }, "Branding result deleted");
  }

  async function handleSaveBrandingEdit() {
    if (!selectedWebsite || !editingBrandingResult) return;
    await runBrandingAction(`edit-branding-${editingBrandingResult.id}`, async () => {
      const response = await updateNewsBrandingResult(selectedWebsite.id, editingBrandingResult.id, {
        ...brandingEditDraft,
        status: brandingEditDraft.is_false_positive ? "false_positive" : "reviewed",
      });
      setBrandingResults((current) => current.map((item) => (item.id === response.item.id ? response.item : item)));
      setEditingBrandingResult(null);
    }, "Branding label updated");
  }

  const websiteArticleCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of websiteWorkspaceArticles) {
      const key = article.category || "Uncategorized";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [websiteWorkspaceArticles]);

  const websiteBrandPlacements = useMemo(() => {
    const counts = new Map<string, number>();
    for (const result of brandingResults) {
      const key = result.placement || "unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [brandingResults]);

  if (loading && !settings && websites.length === 0 && status.summary.activeWebsites === 0) {
    return <div className="glass-premium rounded-2xl p-5 text-sm text-muted-foreground">Loading Web Paper crawler...</div>;
  }

  if (isBrandingOnly) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Connected Websites" value={String(websites.length)} note="News websites available for branding scans" />
          <SummaryCard label="Latest Selected Site" value={selectedWebsite?.name || "None"} note={selectedWebsite ? "Open workspace for screenshots" : "Choose a website below"} />
          <SummaryCard label="Detected Ads" value={selectedWebsite ? String(brandingSummary.totalAdsDetected) : "0"} note={selectedWebsite ? `${brandingSummary.totalUniqueBrands} unique brands` : "No website selected"} />
          <SummaryCard label="Last Scan" value={selectedWebsite ? formatShortDateTime(brandingSummary.lastScanTime) : "Never"} note={selectedWebsite ? brandingSummary.mostCommonAdPlacement : "Run a scan to capture screenshots"} />
        </div>

        <div className="glass-premium rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">Connected News Websites</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Open a site to review branding screenshots, detected ads, sponsored placements, and scan schedules.
              </div>
            </div>
            <Button variant="outline" onClick={() => void refreshAll()} disabled={Boolean(busyAction)}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh Websites
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {websites.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/40 px-6 py-12 text-center text-sm text-muted-foreground">
                No connected news websites are available yet. Add and manage websites from the Newspaper page, then use Media Intelligence for branding scans and screenshots.
              </div>
            )}
            {websites.map((website) => (
              <div key={website.id} className="rounded-2xl border border-border/30 bg-background/70 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-foreground">{website.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{website.base_url}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{website.scraper_key}</Badge>
                      <Badge variant={website.is_active ? "default" : "secondary"}>{website.is_active ? "active" : "paused"}</Badge>
                      <Badge variant="outline">{website.crawl_interval_minutes} min</Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={() => void handleRunBrandingScanForWebsite(website)} disabled={brandingBusyAction !== null}>
                      <Play className="mr-2 h-4 w-4" />
                      Send Bot
                    </Button>
                    <Button variant="outline" onClick={() => void openWebsiteWorkspace(website)}>
                      Open Branding
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border/20 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Last Crawl</div>
                    <div className="mt-2 text-sm font-medium text-foreground">{formatShortDateTime(website.last_crawled_at)}</div>
                  </div>
                  <div className="rounded-xl border border-border/20 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Backfill</div>
                    <div className="mt-2 text-sm font-medium text-foreground">{website.is_backfill_completed ? "Completed" : "Pending"}</div>
                  </div>
                  <div className="rounded-xl border border-border/20 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Branding</div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {selectedWebsite?.id === website.id ? `${brandingSummary.totalAdsDetected} detections` : "Open workspace"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
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

      <Tabs defaultValue={initialTab} className="space-y-5">
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
                        <Button variant="outline" size="sm" onClick={() => void openWebsiteWorkspace(website)}>
                          Open Workspace
                        </Button>
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

      <Dialog
        open={Boolean(selectedWebsite)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedWebsite(null);
            setPreviewBrandingResult(null);
            setEditingBrandingResult(null);
          }
        }}
      >
        <DialogContent className="max-w-7xl">
          <DialogHeader>
            <DialogTitle>{selectedWebsite?.name} {isBrandingOnly ? "Branding Monitor" : "Workspace"}</DialogTitle>
          </DialogHeader>

          {selectedWebsite && (
            <Tabs value={websiteWorkspaceTab} onValueChange={setWebsiteWorkspaceTab} className="space-y-5">
              {!isBrandingOnly && (
                <TabsList className="bg-muted/30 border border-border/30 h-10 p-0.5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="articles">Articles / Pages</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="branding">Branding</TabsTrigger>
                </TabsList>
              )}

              {!isBrandingOnly && <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard label="Website" value={selectedWebsite.name} note={selectedWebsite.domain} />
                  <SummaryCard label="Base URL" value={selectedWebsite.base_url.replace(/^https?:\/\//, "")} note="Connected news website" />
                  <SummaryCard label="Articles" value={String(websiteWorkspaceArticles.length)} note="Latest tracked pages" />
                  <SummaryCard label="Last Crawled" value={formatDateTime(selectedWebsite.last_crawled_at)} note={selectedWebsite.is_active ? "Website active" : "Website paused"} />
                </div>

                <div className="glass-premium rounded-2xl p-5">
                  <div className="text-sm font-medium text-foreground">Connected Website Details</div>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/30 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Scraper</div>
                      <div className="mt-2 text-sm font-medium text-foreground">{selectedWebsite.scraper_key}</div>
                      <div className="mt-3 text-xs text-muted-foreground">Backfill status: {selectedWebsite.is_backfill_completed ? "Completed" : "Pending"}</div>
                    </div>
                    <div className="rounded-2xl border border-border/30 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Branding Monitor</div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {brandingSummary.totalAdsDetected > 0
                          ? `${brandingSummary.totalAdsDetected} detections across ${brandingSummary.totalPagesScanned} pages`
                          : "No branding scans yet"}
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">Latest scan: {formatDateTime(brandingSummary.lastScanTime)}</div>
                    </div>
                  </div>
                </div>
              </TabsContent>}

              {!isBrandingOnly && <TabsContent value="articles" className="space-y-4">
                <div className="glass-premium rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-foreground">Latest Pages for {selectedWebsite.name}</div>
                    <Button variant="outline" size="sm" onClick={() => void loadWebsiteWorkspaceArticles(selectedWebsite.id)}>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Refresh Pages
                    </Button>
                  </div>
                </div>
                <div className="glass-premium rounded-2xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Published</TableHead>
                        <TableHead>Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {websiteWorkspaceArticlesLoading && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Loading pages...</TableCell>
                        </TableRow>
                      )}
                      {!websiteWorkspaceArticlesLoading && websiteWorkspaceArticles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No tracked pages saved for this website yet.</TableCell>
                        </TableRow>
                      )}
                      {websiteWorkspaceArticles.map((article) => (
                        <TableRow key={article.id}>
                          <TableCell>
                            <div className="font-medium text-foreground">{article.title}</div>
                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.url}</div>
                          </TableCell>
                          <TableCell>{article.category || "Uncategorized"}</TableCell>
                          <TableCell>{formatDateTime(article.published_at)}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" asChild>
                              <a href={article.url} target="_blank" rel="noreferrer">
                                Open
                                <ExternalLink className="ml-2 h-3 w-3" />
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>}

              {!isBrandingOnly && <TabsContent value="analytics" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="glass-premium rounded-2xl p-5">
                    <div className="text-sm font-medium text-foreground">Top Article Categories</div>
                    <div className="mt-4 space-y-3">
                      {websiteArticleCategories.length === 0 && <div className="text-sm text-muted-foreground">No category data yet.</div>}
                      {websiteArticleCategories.map(([category, count]) => (
                        <div key={category} className="flex items-center justify-between rounded-xl border border-border/30 px-4 py-3">
                          <span className="text-sm text-foreground">{category}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="glass-premium rounded-2xl p-5">
                    <div className="text-sm font-medium text-foreground">Most Common Brand Placements</div>
                    <div className="mt-4 space-y-3">
                      {websiteBrandPlacements.length === 0 && <div className="text-sm text-muted-foreground">No branding detections yet.</div>}
                      {websiteBrandPlacements.map(([placement, count]) => (
                        <div key={placement} className="flex items-center justify-between rounded-xl border border-border/30 px-4 py-3">
                          <span className="text-sm text-foreground">{placement}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>}

              <TabsContent value="branding" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard label="Pages Scanned" value={String(brandingSummary.totalPagesScanned)} note="Unique URLs captured" />
                  <SummaryCard label="Ads Detected" value={String(brandingSummary.totalAdsDetected)} note={`${brandingSummary.averageAdsPerPage} ads per page`} />
                  <SummaryCard label="Unique Brands" value={String(brandingSummary.totalUniqueBrands)} note={`Most common: ${brandingSummary.mostCommonAdPlacement}`} />
                  <SummaryCard label="Failed Scans" value={String(brandingSummary.failedScans)} note={`Last scan: ${formatDateTime(brandingSummary.lastScanTime)}`} />
                </div>

                <div className="glass-premium rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="text-sm font-medium text-foreground">Branding Scan Controls</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Detect ads, sponsored placements, and brand visibility for the selected connected news website.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => void handleRunBrandingScan()} disabled={brandingBusyAction !== null}>
                        <Play className="mr-2 h-4 w-4" />
                        Send Bot for Screenshots
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handleStopBrandingScan()}
                        disabled={!brandingScanStatus || !["queued", "running", "stopping"].includes(brandingScanStatus.status) || brandingBusyAction !== null}
                      >
                        <StopCircle className="mr-2 h-4 w-4" />
                        Stop Running Scan
                      </Button>
                      <Button variant="outline" onClick={() => void handleExportBrandingResults("csv")} disabled={brandingBusyAction !== null}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                      <Button variant="outline" onClick={() => void handleExportBrandingResults("json")} disabled={brandingBusyAction !== null}>
                        Export JSON
                      </Button>
                      <Button variant="outline" onClick={() => void handleExportBrandingResults("zip")} disabled={brandingBusyAction !== null}>
                        Export ZIP
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="space-y-3 rounded-2xl border border-border/30 p-4">
                      <div className="text-sm font-medium text-foreground">Scan Devices</div>
                      <div className="flex flex-wrap gap-2">
                        {["desktop", "tablet", "mobile"].map((device) => (
                          <Button
                            key={device}
                            type="button"
                            variant={brandingScanDeviceTypes.includes(device) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleBrandingDevice(device)}
                          >
                            {device}
                          </Button>
                        ))}
                      </div>
                      {brandingScanStatus && (
                        <div className="rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                          Latest scan status: <span className="font-medium text-foreground">{brandingScanStatus.status}</span>
                          {" • "}
                          {brandingScanStatus.progress}% complete
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 rounded-2xl border border-border/30 p-4">
                      <div className="text-sm font-medium text-foreground">Schedule Scan</div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Enabled</Label>
                          <Switch
                            checked={brandingScheduleDraft.enabled}
                            onCheckedChange={(checked) => setBrandingScheduleDraft((current) => ({ ...current, enabled: checked }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Frequency</Label>
                          <Select
                            value={brandingScheduleDraft.frequency}
                            onValueChange={(value: "daily" | "weekly" | "monthly") => setBrandingScheduleDraft((current) => ({ ...current, frequency: value }))}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Time</Label>
                          <Input
                            type="time"
                            value={brandingScheduleDraft.time}
                            onChange={(event) => setBrandingScheduleDraft((current) => ({ ...current, time: event.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Max URLs / Scan</Label>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={brandingScheduleDraft.max_urls_per_scan}
                            onChange={(event) => setBrandingScheduleDraft((current) => ({ ...current, max_urls_per_scan: Number(event.target.value || 25) }))}
                          />
                        </div>
                      </div>
                      <Button variant="secondary" onClick={() => void handleSaveBrandingSchedule()} disabled={brandingBusyAction !== null}>
                        Save Schedule Scan
                      </Button>
                      {brandingSchedule?.next_run_at && (
                        <div className="text-xs text-muted-foreground">Next scheduled run: {formatDateTime(brandingSchedule.next_run_at)}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="glass-premium rounded-2xl p-4">
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-8">
                    <Input type="date" value={brandingFilters.date_from} onChange={(event) => setBrandingFilters((current) => ({ ...current, date_from: event.target.value }))} />
                    <Input type="date" value={brandingFilters.date_to} onChange={(event) => setBrandingFilters((current) => ({ ...current, date_to: event.target.value }))} />
                    <Input value={brandingFilters.page_url} onChange={(event) => setBrandingFilters((current) => ({ ...current, page_url: event.target.value }))} placeholder="Filter by page URL" />
                    <Input value={brandingFilters.brand_name} onChange={(event) => setBrandingFilters((current) => ({ ...current, brand_name: event.target.value }))} placeholder="Filter by brand" />
                    <Select value={brandingFilters.ad_type} onValueChange={(value) => setBrandingFilters((current) => ({ ...current, ad_type: value }))}>
                      <SelectTrigger><SelectValue placeholder="Ad type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All ad types</SelectItem>
                        {["display_banner", "native_ad", "sponsored_article", "video_ad", "sidebar_ad", "header_banner", "footer_banner", "in_article_ad", "branded_content", "unknown"].map((item) => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={brandingFilters.placement} onValueChange={(value) => setBrandingFilters((current) => ({ ...current, placement: value }))}>
                      <SelectTrigger><SelectValue placeholder="Placement" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All placements</SelectItem>
                        {["header", "sidebar", "in_article", "footer", "sticky", "popup", "homepage_hero", "related_articles", "unknown"].map((item) => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={brandingFilters.device_type} onValueChange={(value) => setBrandingFilters((current) => ({ ...current, device_type: value }))}>
                      <SelectTrigger><SelectValue placeholder="Device" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All devices</SelectItem>
                        <SelectItem value="desktop">Desktop</SelectItem>
                        <SelectItem value="tablet">Tablet</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={brandingFilters.status} onValueChange={(value) => setBrandingFilters((current) => ({ ...current, status: value }))}>
                      <SelectTrigger><SelectValue placeholder="Scan status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="detected">Detected</SelectItem>
                        <SelectItem value="reviewed">Reviewed</SelectItem>
                        <SelectItem value="false_positive">False Positive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="glass-premium rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <LayoutGrid className="h-4 w-4 text-primary" />
                    Screenshot Gallery
                  </div>
                  {brandingResults.length === 0 && !brandingLoading ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-border/40 px-6 py-12 text-center text-sm text-muted-foreground">
                      No branding scans yet. Run your first scan to detect ads, sponsored placements, and brand visibility on this news website.
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {brandingResults.map((result) => (
                        <div key={result.id} className="rounded-2xl border border-border/30 bg-background/70 overflow-hidden">
                          <div className="aspect-[16/10] bg-muted/30">
                            {result.screenshot_url ? (
                              <img src={result.screenshot_url} alt={result.brand_name || result.ad_type || "Branding capture"} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No screenshot</div>
                            )}
                          </div>
                          <div className="space-y-2 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-foreground">{result.brand_name || "Unlabeled Brand"}</div>
                                <div className="text-xs text-muted-foreground">{cleanDisplayText(result.page_url)}</div>
                              </div>
                              <Badge variant="outline">{result.device_type || "unknown"}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>{result.ad_type || "unknown"}</span>
                              <span>{result.placement || "unknown"}</span>
                              <span>{formatShortDateTime(result.captured_at)}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => setPreviewBrandingResult(result)}>
                                <Eye className="mr-2 h-3.5 w-3.5" />
                                View
                              </Button>
                              <Button variant="outline" size="sm" asChild disabled={!result.screenshot_url}>
                                <a href={result.screenshot_url || "#"} target="_blank" rel="noreferrer">
                                  <Download className="mr-2 h-3.5 w-3.5" />
                                  Download
                                </a>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="glass-premium rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground">
                    <SquareChartGantt className="h-4 w-4 text-primary" />
                    Detection Table
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Website</TableHead>
                        <TableHead>Page URL</TableHead>
                        <TableHead>Brand Name</TableHead>
                        <TableHead>Ad Type</TableHead>
                        <TableHead>Placement</TableHead>
                        <TableHead>Screenshot</TableHead>
                        <TableHead>Captured At</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brandingLoading && (
                        <TableRow>
                          <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">Loading branding results...</TableCell>
                        </TableRow>
                      )}
                      {!brandingLoading && brandingResults.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">No branding detections match the current filters.</TableCell>
                        </TableRow>
                      )}
                      {brandingResults.map((result) => (
                        <TableRow key={result.id}>
                          <TableCell>{selectedWebsite.name}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{result.page_url}</TableCell>
                          <TableCell>{result.brand_name || "Unlabeled"}</TableCell>
                          <TableCell>{result.ad_type || "unknown"}</TableCell>
                          <TableCell>{result.placement || "unknown"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setPreviewBrandingResult(result)}>
                              <Eye className="mr-2 h-3.5 w-3.5" />
                              View
                            </Button>
                          </TableCell>
                          <TableCell>{formatShortDateTime(result.captured_at)}</TableCell>
                          <TableCell>{result.device_type || "unknown"}</TableCell>
                          <TableCell>
                            <Badge variant={result.is_false_positive ? "secondary" : "outline"}>
                              {result.is_false_positive ? "false_positive" : result.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => {
                                setEditingBrandingResult(result);
                                setBrandingEditDraft({
                                  brand_name: result.brand_name || "",
                                  ad_type: result.ad_type || "",
                                  placement: result.placement || "",
                                  is_false_positive: result.is_false_positive,
                                });
                              }}>
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => void runBrandingAction(`flag-${result.id}`, async () => {
                                const response = await updateNewsBrandingResult(selectedWebsite.id, result.id, {
                                  is_false_positive: !result.is_false_positive,
                                  status: !result.is_false_positive ? "false_positive" : "detected",
                                });
                                setBrandingResults((current) => current.map((item) => item.id === response.item.id ? response.item : item));
                              }, result.is_false_positive ? "Marked as valid detection" : "Marked as false positive")}>
                                {result.is_false_positive ? "Restore" : "False Positive"}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => void handleDeleteBrandingResult(result.id)}>
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
                  <span>{brandingPagination.total} branding detections</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={brandingPagination.page <= 1} onClick={() => void loadBrandingResults(selectedWebsite.id, brandingPagination.page - 1)}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={brandingPagination.page >= brandingPagination.pages} onClick={() => void loadBrandingResults(selectedWebsite.id, brandingPagination.page + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewBrandingResult)} onOpenChange={(open) => { if (!open) setPreviewBrandingResult(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewBrandingResult?.brand_name || "Branding Capture"}</DialogTitle>
          </DialogHeader>
          {previewBrandingResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Detected Element</div>
                  {previewBrandingResult.screenshot_url ? (
                    <img src={previewBrandingResult.screenshot_url} alt={previewBrandingResult.brand_name || "Element capture"} className="w-full rounded-2xl border border-border/30 object-cover" />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/40 px-6 py-12 text-center text-sm text-muted-foreground">Element screenshot unavailable.</div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Full Page</div>
                  {previewBrandingResult.full_page_screenshot_url ? (
                    <img src={previewBrandingResult.full_page_screenshot_url} alt="Full page capture" className="w-full rounded-2xl border border-border/30 object-cover" />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/40 px-6 py-12 text-center text-sm text-muted-foreground">Full-page screenshot unavailable.</div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Brand" value={previewBrandingResult.brand_name || "Unknown"} note={previewBrandingResult.page_url} />
                <SummaryCard label="Ad Type" value={previewBrandingResult.ad_type || "unknown"} note={previewBrandingResult.selector || "No selector"} />
                <SummaryCard label="Placement" value={previewBrandingResult.placement || "unknown"} note={previewBrandingResult.device_type || "unknown"} />
                <SummaryCard label="Captured" value={formatShortDateTime(previewBrandingResult.captured_at)} note={`Confidence ${previewBrandingResult.confidence ?? 0}`} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingBrandingResult)} onOpenChange={(open) => { if (!open) setEditingBrandingResult(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Branding Detection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Brand Name</Label>
              <Input value={brandingEditDraft.brand_name} onChange={(event) => setBrandingEditDraft((current) => ({ ...current, brand_name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Ad Type</Label>
              <Input value={brandingEditDraft.ad_type} onChange={(event) => setBrandingEditDraft((current) => ({ ...current, ad_type: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Placement</Label>
              <Input value={brandingEditDraft.placement} onChange={(event) => setBrandingEditDraft((current) => ({ ...current, placement: event.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/30 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-foreground">False Positive</div>
                <div className="text-xs text-muted-foreground">Hide this detection from valid ad-branding counts.</div>
              </div>
              <Switch
                checked={brandingEditDraft.is_false_positive}
                onCheckedChange={(checked) => setBrandingEditDraft((current) => ({ ...current, is_false_positive: checked }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingBrandingResult(null)}>Cancel</Button>
              <Button onClick={() => void handleSaveBrandingEdit()}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
