import { useEffect, useMemo, useState } from "react";
import { BellRing, Clock3, Database, Radar, Settings, Shield, Users } from "lucide-react";
import { PageVisualDeck } from "@/components/PageVisualDeck";
import {
  createMediaWatchTerm,
  createSummarySchedule,
  deleteMediaWatchTerm,
  deleteSummarySchedule,
  getMediaDailyStats,
  getMediaSpikeAlerts,
  getMediaWatchTerms,
  getSummarySchedules,
  getWorkspaceDiagnostics,
  reconcileTvWorkspaceData,
  refreshMediaIntelligence,
  runSummaryScheduleNow,
  updateMediaWatchTerm,
  updateSummarySchedule,
  type MediaDailyStatRecord,
  type MediaRefreshResponse,
  type MediaSpikeAlertRecord,
  type MediaWatchTermRecord,
  type SummaryDispatchLogRecord,
  type SummaryScheduleRecord,
  type TvReconcileResponse,
  type WorkspaceDiagnosticsResponse,
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

function DistributionTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ organizationId: string; organizationName: string; organizationSlug: string | null; count: number }>;
}) {
  return (
    <div className="glass-premium rounded-2xl p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={`${title}-${row.organizationId}`} className="rounded-xl border border-border/40 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{row.organizationName}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.organizationId}</p>
                  {row.organizationSlug && <p className="text-[11px] text-primary">{row.organizationSlug}</p>}
                </div>
                <span className="font-mono text-sm text-foreground">{row.count}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No rows found.</p>
      )}
    </div>
  );
}

function sourceKindLabel(sourceKind: string) {
  if (sourceKind === "all") return "All Media";
  if (sourceKind === "tv") return "TV";
  if (sourceKind === "news") return "News";
  if (sourceKind === "epaper") return "E-Paper";
  return sourceKind;
}

export default function AdminPage() {
  const [diagnostics, setDiagnostics] = useState<WorkspaceDiagnosticsResponse | null>(null);
  const [sourceOrganizationId, setSourceOrganizationId] = useState("");
  const [reconcileResult, setReconcileResult] = useState<TvReconcileResponse | null>(null);
  const [watchTerms, setWatchTerms] = useState<MediaWatchTermRecord[]>([]);
  const [dailyStats, setDailyStats] = useState<MediaDailyStatRecord[]>([]);
  const [spikeAlerts, setSpikeAlerts] = useState<MediaSpikeAlertRecord[]>([]);
  const [refreshResult, setRefreshResult] = useState<MediaRefreshResponse | null>(null);
  const [summarySchedules, setSummarySchedules] = useState<SummaryScheduleRecord[]>([]);
  const [summaryDispatchLogs, setSummaryDispatchLogs] = useState<SummaryDispatchLogRecord[]>([]);
  const [termForm, setTermForm] = useState({
    term: "",
    termType: "keyword" as "brand" | "competitor" | "keyword",
    language: "",
  });
  const [scheduleForm, setScheduleForm] = useState({
    name: "Daily Brand & Competitor Summary",
    frequency: "daily" as "daily" | "weekly",
    hourOfDay: "9",
    dayOfWeek: "1",
    app: true,
    email: true,
  });
  const [loading, setLoading] = useState(true);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [watchTermLoading, setWatchTermLoading] = useState(false);
  const [refreshingIntelligence, setRefreshingIntelligence] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [workspaceResponse, watchTermsResponse, dailyStatsResponse, spikeAlertsResponse, schedulesResponse] = await Promise.all([
        getWorkspaceDiagnostics(),
        getMediaWatchTerms(),
        getMediaDailyStats({ limit: 20, sourceKind: "all" }),
        getMediaSpikeAlerts(12),
        getSummarySchedules(20),
      ]);

      setDiagnostics(workspaceResponse);
      setWatchTerms(watchTermsResponse.items);
      setDailyStats(dailyStatsResponse.items);
      setSpikeAlerts(spikeAlertsResponse.items);
      setSummarySchedules(schedulesResponse.items);
      setSummaryDispatchLogs(schedulesResponse.dispatchLogs);
      setSourceOrganizationId(
        (current) =>
          current ||
          workspaceResponse.tvDistribution.tv_segments.find((item) => item.organizationId !== workspaceResponse.currentOrganization?.id)?.organizationId ||
          "",
      );
    } catch (error) {
      toast({
        title: "Unable to load admin data",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, []);

  const healthCards = useMemo(
    () => [
      { icon: Users, title: "Workspace", desc: diagnostics?.currentOrganization?.name || "Unknown", stat: diagnostics?.currentOrganization?.id || "-" },
      { icon: Database, title: "TV Segments", desc: "Rows visible in current workspace", stat: String(diagnostics?.currentCounts.tvSegments || 0) },
      { icon: Shield, title: "Transcript Rows", desc: "Transcript segments in current workspace", stat: String(diagnostics?.currentCounts.tvTranscriptSegments || 0) },
      { icon: Radar, title: "Watch Terms", desc: "Active monitored terms", stat: String(watchTerms.filter((item) => item.is_active).length) },
    ],
    [diagnostics, watchTerms],
  );

  const runReconcile = async (dryRun: boolean) => {
    if (!sourceOrganizationId.trim()) {
      toast({
        title: "Source org required",
        description: "Enter the organization ID you want to reconcile from.",
        variant: "destructive",
      });
      return;
    }

    try {
      setReconcileLoading(true);
      const response = await reconcileTvWorkspaceData({
        sourceOrganizationId: sourceOrganizationId.trim(),
        dryRun,
      });
      setReconcileResult(response);
      toast({
        title: dryRun ? "Dry run complete" : "Reconciliation complete",
        description: dryRun ? "Review the move plan before applying it." : "TV workspace rows were reconciled.",
      });
      if (!dryRun) {
        await loadAdminData();
      }
    } catch (error) {
      toast({
        title: dryRun ? "Dry run failed" : "Reconciliation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setReconcileLoading(false);
    }
  };

  const addWatchTerm = async () => {
    if (!termForm.term.trim()) {
      toast({
        title: "Term required",
        description: "Enter a brand, competitor, or keyword term first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setWatchTermLoading(true);
      const response = await createMediaWatchTerm({
        term: termForm.term.trim(),
        termType: termForm.termType,
        language: termForm.language.trim() || undefined,
      });
      setWatchTerms((current) => [response.item, ...current]);
      setTermForm({ term: "", termType: "keyword", language: "" });
      toast({
        title: "Watch term created",
        description: "The media intelligence engine will start tracking it.",
      });
    } catch (error) {
      toast({
        title: "Unable to create watch term",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWatchTermLoading(false);
    }
  };

  const toggleWatchTerm = async (item: MediaWatchTermRecord) => {
    try {
      setWatchTermLoading(true);
      const response = await updateMediaWatchTerm(item.id, { isActive: !item.is_active });
      setWatchTerms((current) => current.map((watchTerm) => (watchTerm.id === item.id ? response.item : watchTerm)));
    } catch (error) {
      toast({
        title: "Unable to update watch term",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWatchTermLoading(false);
    }
  };

  const removeWatchTerm = async (id: string) => {
    try {
      setWatchTermLoading(true);
      await deleteMediaWatchTerm(id);
      setWatchTerms((current) => current.filter((item) => item.id !== id));
      toast({
        title: "Watch term removed",
        description: "It will no longer be included in trend analysis.",
      });
    } catch (error) {
      toast({
        title: "Unable to remove watch term",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWatchTermLoading(false);
    }
  };

  const runIntelligenceRefresh = async () => {
    try {
      setRefreshingIntelligence(true);
      const response = await refreshMediaIntelligence({ days: 7, createAlerts: true });
      setRefreshResult(response.result);
      const [dailyStatsResponse, spikeAlertsResponse] = await Promise.all([
        getMediaDailyStats({ limit: 20, sourceKind: "all" }),
        getMediaSpikeAlerts(12),
      ]);
      setDailyStats(dailyStatsResponse.items);
      setSpikeAlerts(spikeAlertsResponse.items);
      toast({
        title: "Media intelligence refreshed",
        description: `Processed ${response.result.trackedTerms} tracked terms and updated ${response.result.updatedStatRows} daily stats.`,
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshingIntelligence(false);
    }
  };

  const addSchedule = async () => {
    try {
      setScheduleLoading(true);
      const deliveryChannels = [
        ...(scheduleForm.app ? (["app"] as const) : []),
        ...(scheduleForm.email ? (["email"] as const) : []),
      ];

      if (deliveryChannels.length === 0) {
        throw new Error("Select at least one delivery channel");
      }

      const response = await createSummarySchedule({
        name: scheduleForm.name.trim(),
        frequency: scheduleForm.frequency,
        deliveryChannels: [...deliveryChannels],
        hourOfDay: Number(scheduleForm.hourOfDay),
        dayOfWeek: scheduleForm.frequency === "weekly" ? Number(scheduleForm.dayOfWeek) : null,
        isActive: true,
      });
      setSummarySchedules((current) => [response.item, ...current]);
      toast({
        title: "Summary schedule created",
        description: "The worker will start generating app and email-style summaries on schedule.",
      });
    } catch (error) {
      toast({
        title: "Unable to create summary schedule",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setScheduleLoading(false);
    }
  };

  const toggleSchedule = async (item: SummaryScheduleRecord) => {
    try {
      setScheduleLoading(true);
      const response = await updateSummarySchedule(item.id, { isActive: !item.is_active });
      setSummarySchedules((current) => current.map((schedule) => (schedule.id === item.id ? response.item : schedule)));
    } catch (error) {
      toast({
        title: "Unable to update schedule",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setScheduleLoading(false);
    }
  };

  const removeSchedule = async (id: string) => {
    try {
      setScheduleLoading(true);
      await deleteSummarySchedule(id);
      setSummarySchedules((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      toast({
        title: "Unable to delete schedule",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setScheduleLoading(false);
    }
  };

  const runScheduleNow = async (id: string) => {
    try {
      setScheduleLoading(true);
      await runSummaryScheduleNow(id);
      const schedulesResponse = await getSummarySchedules(20);
      setSummarySchedules(schedulesResponse.items);
      setSummaryDispatchLogs(schedulesResponse.dispatchLogs);
      toast({
        title: "Summary dispatched",
        description: "The selected schedule was executed immediately.",
      });
    } catch (error) {
      toast({
        title: "Unable to run schedule",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setScheduleLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
          <Settings className="h-5 w-5 text-primary" />
          Admin
        </h1>
        <p className="text-sm text-muted-foreground">Workspace diagnostics, media intelligence operations, scheduled summaries, and data repair tools</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {healthCards.map((item) => (
          <div key={item.title} className="glass-premium interactive-surface rounded-lg p-5">
            <item.icon className="mb-3 h-5 w-5 text-primary" />
            <h3 className="mb-1 text-sm font-semibold text-foreground">{item.title}</h3>
            <p className="mb-2 text-xs text-muted-foreground">{item.desc}</p>
            <span className="break-all font-mono text-xs text-nucleus-positive">{item.stat}</span>
          </div>
        ))}
      </div>

      <div className="glass-premium rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Media Intelligence Operations</h2>
          <Button onClick={() => void runIntelligenceRefresh()} disabled={refreshingIntelligence}>
            <Radar className="h-4 w-4" />
            Refresh Last 7 Days
          </Button>
        </div>

        {refreshResult && (
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm">
            <p className="font-semibold text-foreground">Latest refresh</p>
            <p className="mt-1 text-muted-foreground">
              {refreshResult.trackedTerms} tracked terms processed, {refreshResult.updatedStatRows} stat rows updated, {refreshResult.generatedAlerts} spike alerts generated.
            </p>
            <p className="mt-1 text-xs text-primary">
              Window: {new Date(refreshResult.from).toLocaleString()} to {new Date(refreshResult.to).toLocaleString()}
            </p>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Watch Terms</p>
            <div className="grid gap-3 lg:grid-cols-[1.3fr_0.8fr_0.8fr_auto]">
              <Input value={termForm.term} onChange={(event) => setTermForm((current) => ({ ...current, term: event.target.value }))} placeholder="Add brand, competitor, or keyword" />
              <Input value={termForm.language} onChange={(event) => setTermForm((current) => ({ ...current, language: event.target.value }))} placeholder="Language" />
              <div className="flex flex-wrap gap-2">
                {(["brand", "competitor", "keyword"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTermForm((current) => ({ ...current, termType: type }))}
                    className={`rounded-full px-3 py-2 text-xs transition-colors ${
                      termForm.termType === type ? "border border-primary/20 bg-primary/15 text-primary" : "border border-border/50 text-muted-foreground"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <Button onClick={() => void addWatchTerm()} disabled={watchTermLoading}>
                Add
              </Button>
            </div>

            {watchTerms.length > 0 ? (
              <div className="space-y-2">
                {watchTerms.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-border/40 bg-background/60 p-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{item.term}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.term_type} {item.language ? `| ${item.language}` : ""} | {item.is_active ? "active" : "paused"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => void toggleWatchTerm(item)} disabled={watchTermLoading}>
                        {item.is_active ? "Pause" : "Activate"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void removeWatchTerm(item.id)} disabled={watchTermLoading}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No custom watch terms yet. Brand and onboarding competitors are still tracked automatically.</p>
            )}
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Recent Spike Alerts</p>
            </div>
            {spikeAlerts.length > 0 ? (
              <div className="space-y-2">
                {spikeAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-border/30 bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{alert.message}</p>
                      <span className="rounded-full border border-border/40 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-primary">
                        {alert.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{new Date(alert.triggered_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No media spike alerts have been generated yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Daily Keyword Stats</p>
          {dailyStats.length > 0 ? (
            <div className="space-y-2">
              {dailyStats.map((item) => (
                <div key={`${item.normalized_keyword}-${item.source_kind}-${item.bucket_date}`} className="flex flex-col gap-2 rounded-lg border border-border/30 bg-background/60 p-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.keyword}</p>
                    <p className="text-xs text-muted-foreground">
                      {sourceKindLabel(item.source_kind)} | {item.bucket_date} | {item.document_count} docs | {item.channel_count} channels
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-primary">{item.occurrence_count} mentions</p>
                    <p className="text-xs text-muted-foreground">Trend score {item.trend_score}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No daily stats yet. Run a refresh to build the first keyword trend snapshots.</p>
          )}
        </div>
      </div>

      <div className="glass-premium rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Scheduled Email / App Summaries</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr_auto]">
          <Input value={scheduleForm.name} onChange={(event) => setScheduleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Summary schedule name" />
          <div className="flex flex-wrap gap-2">
            {(["daily", "weekly"] as const).map((frequency) => (
              <button
                key={frequency}
                type="button"
                onClick={() => setScheduleForm((current) => ({ ...current, frequency }))}
                className={`rounded-full px-3 py-2 text-xs transition-colors ${
                  scheduleForm.frequency === frequency ? "border border-primary/20 bg-primary/15 text-primary" : "border border-border/50 text-muted-foreground"
                }`}
              >
                {frequency}
              </button>
            ))}
          </div>
          <Input value={scheduleForm.hourOfDay} onChange={(event) => setScheduleForm((current) => ({ ...current, hourOfDay: event.target.value }))} placeholder="UTC hour" />
          <Input
            value={scheduleForm.dayOfWeek}
            onChange={(event) => setScheduleForm((current) => ({ ...current, dayOfWeek: event.target.value }))}
            placeholder="Day (0-6)"
            disabled={scheduleForm.frequency !== "weekly"}
          />
          <Button onClick={() => void addSchedule()} disabled={scheduleLoading}>
            Add Schedule
          </Button>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={scheduleForm.app} onChange={(event) => setScheduleForm((current) => ({ ...current, app: event.target.checked }))} />
            App summary
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={scheduleForm.email} onChange={(event) => setScheduleForm((current) => ({ ...current, email: event.target.checked }))} />
            Email summary
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Active schedules</p>
            {summarySchedules.length > 0 ? (
              <div className="space-y-2">
                {summarySchedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-lg border border-border/30 bg-background/60 p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{schedule.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {schedule.frequency} | {schedule.delivery_channels.join(" + ")} | next run {schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleString() : "not scheduled"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => void runScheduleNow(schedule.id)} disabled={scheduleLoading}>
                          Run Now
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void toggleSchedule(schedule)} disabled={scheduleLoading}>
                          {schedule.is_active ? "Pause" : "Activate"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void removeSchedule(schedule.id)} disabled={scheduleLoading}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No summary schedules configured yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Recent summary dispatches</p>
            {summaryDispatchLogs.length > 0 ? (
              <div className="space-y-2">
                {summaryDispatchLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-border/30 bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{log.subject}</p>
                      <span className="rounded-full border border-border/40 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-primary">
                        {log.channel} / {log.delivery_status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{log.recipient || "workspace audience"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No summary dispatches have been recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="glass-premium rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Workspace Diagnostics</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading diagnostics...</p>
        ) : diagnostics ? (
          <>
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm">
              <p className="font-semibold text-foreground">Current workspace</p>
              <p className="mt-1 text-muted-foreground">
                {diagnostics.currentOrganization?.name} ({diagnostics.currentOrganization?.slug})
              </p>
              <p className="mt-1 break-all font-mono text-xs text-primary">{diagnostics.currentOrganization?.id}</p>
              <p className="mt-3 text-muted-foreground">
                Signed in as {diagnostics.currentUser.fullName || "Unknown user"} - {diagnostics.currentUser.email || "No email"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(diagnostics.currentCounts).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-border/40 bg-muted/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{key}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {diagnostics.recommendations.length > 0 && (
              <div className="rounded-xl border border-amber-300/40 bg-amber-50/60 p-4">
                <p className="text-sm font-semibold text-amber-800">Recommendations</p>
                <div className="mt-2 space-y-1">
                  {diagnostics.recommendations.map((item) => (
                    <p key={item} className="text-sm text-amber-700">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No diagnostics available.</p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DistributionTable title="TV Segments by Organization" rows={diagnostics?.tvDistribution.tv_segments || []} />
        <DistributionTable title="TV YouTube Channels by Organization" rows={diagnostics?.tvDistribution.tv_youtube_channels || []} />
        <DistributionTable title="TV YouTube Videos by Organization" rows={diagnostics?.tvDistribution.tv_youtube_videos || []} />
        <DistributionTable title="TV Transcript Segments by Organization" rows={diagnostics?.tvDistribution.tv_transcript_segments || []} />
      </div>

      <div className="glass-premium rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">TV Data Reconciliation</h2>
        <p className="text-sm text-muted-foreground">
          Use this only if you intentionally want to move TV rows from one organization into the current workspace.
          This is not automatic because organizations are isolated by design.
        </p>
        <Input value={sourceOrganizationId} onChange={(event) => setSourceOrganizationId(event.target.value)} placeholder="Source organization ID to reconcile from" />
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void runReconcile(true)} disabled={reconcileLoading}>
            Dry Run
          </Button>
          <Button onClick={() => void runReconcile(false)} disabled={reconcileLoading}>
            Reconcile Into Current Workspace
          </Button>
        </div>

        {reconcileResult && (
          <div className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-4 text-sm">
            <p className="font-semibold text-foreground">{reconcileResult.dryRun ? "Dry Run Result" : "Reconciliation Result"}</p>
            <p className="text-muted-foreground">Source: {reconcileResult.sourceOrganizationId}</p>
            <p className="text-muted-foreground">Target: {reconcileResult.targetOrganizationId}</p>
            {reconcileResult.warning && <p className="text-amber-700">{reconcileResult.warning}</p>}
            <div className="grid gap-2 md:grid-cols-2">
              {Object.entries(reconcileResult.moved).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-border/30 bg-background/60 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{key}</p>
                  <p className="font-mono text-foreground">{value}</p>
                </div>
              ))}
            </div>
            {(reconcileResult.conflicts.tv_youtube_channels.length > 0 || reconcileResult.conflicts.tv_youtube_videos.length > 0) && (
              <div className="space-y-2">
                <p className="font-semibold text-foreground">Conflicts not moved</p>
                {reconcileResult.conflicts.tv_youtube_channels.length > 0 && (
                  <p className="text-muted-foreground">Channel IDs: {reconcileResult.conflicts.tv_youtube_channels.join(", ")}</p>
                )}
                {reconcileResult.conflicts.tv_youtube_videos.length > 0 && (
                  <p className="text-muted-foreground">Video IDs: {reconcileResult.conflicts.tv_youtube_videos.join(", ")}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <PageVisualDeck
        eyebrow="System Health"
        title="Operational quality, stability, and trust"
        description="This admin space now surfaces live diagnostics, media intelligence controls, and scheduled summary operations."
        cards={[
          {
            kind: "line",
            title: "TV Segment Footprint",
            value: String(diagnostics?.currentCounts.tvSegments || 0),
            subtitle: "Current workspace rows",
            footer: "Broadcast visibility",
            color: "#24c7d9",
            fill: "rgba(36, 199, 217, 0.16)",
            values: (diagnostics?.tvDistribution.tv_segments || []).map((item) => item.count),
          },
          {
            kind: "bar",
            title: "YouTube Channel Scope",
            value: String(diagnostics?.currentCounts.tvYoutubeChannels || 0),
            subtitle: "Connected channels",
            footer: "Workspace-level count",
            color: "#8b5cf6",
            values: (diagnostics?.tvDistribution.tv_youtube_channels || []).map((item) => item.count),
          },
          {
            kind: "radial",
            title: "Transcript Readiness",
            value: `${diagnostics?.currentCounts.tvTranscriptSegments || 0}`,
            subtitle: "Transcript rows",
            footer: "Search depends on this table",
            color: "#f97360",
            progress: Math.min(100, (diagnostics?.currentCounts.tvTranscriptSegments || 0) * 5),
          },
        ]}
      />
    </div>
  );
}
