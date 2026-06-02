import { useEffect, useMemo, useState } from "react";
import { Zap, Bell, BellRing } from "lucide-react";
import { PageVisualDeck } from "@/components/PageVisualDeck";
import { acknowledgeAlert, createAlertRule, getAlertRules, getAlerts, type AlertRecord, type AlertRuleRecord } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export default function AlertsPage() {
  const [alertRules, setAlertRules] = useState<AlertRuleRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getAlertRules(), getAlerts()])
      .then(([rulesResponse, alertsResponse]) => {
        if (!active) return;
        setAlertRules(rulesResponse.items);
        setAlerts(alertsResponse.items);
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Unable to load alerts",
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

  const triggerCounts = useMemo(() => {
    const counts = new Map<string, number>();

    alerts.forEach((alert) => {
      const ruleId = typeof alert.ruleId === "string" ? alert.ruleId : alert.ruleId?._id;
      if (!ruleId) return;
      counts.set(ruleId, (counts.get(ruleId) || 0) + 1);
    });

    return counts;
  }, [alerts]);

  const spikeAlerts = useMemo(
    () => alerts.filter((alert) => alert.type === "media_keyword_spike").sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()),
    [alerts],
  );

  const addRule = async () => {
    try {
      const response = await createAlertRule({
        name: `Custom alert rule ${alertRules.length + 1}`,
        type: "volume_spike",
      });
      setAlertRules((prev) => [response.item, ...prev]);
      toast({
        title: "Alert rule created",
        description: `${response.item.name} is now active.`,
      });
    } catch (error) {
      toast({
        title: "Unable to create rule",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      setAcknowledgingId(alertId);
      const response = await acknowledgeAlert(alertId);
      setAlerts((current) => current.map((alert) => (alert._id === alertId ? response.item : alert)));
      toast({
        title: "Alert acknowledged",
        description: "The spike alert has been marked as acknowledged.",
      });
    } catch (error) {
      toast({
        title: "Unable to acknowledge alert",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAcknowledgingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            <Zap className="h-5 w-5 text-nucleus-neutral" />
            Alerts & Rules
          </h1>
          <p className="text-sm text-muted-foreground">Configure real-time alert triggers and manage live keyword spike activity</p>
        </div>
        <button onClick={addRule} className="gradient-primary rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
          + New Rule
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="glass-premium rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Keyword Spike Alerts</h2>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading spike alerts...</p>}
          {!loading && spikeAlerts.length === 0 && <p className="text-sm text-muted-foreground">No keyword spike alerts have been generated for this workspace yet.</p>}
          {spikeAlerts.map((alert) => (
            <div key={alert._id} className="rounded-xl border border-border/40 bg-muted/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{alert.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(alert.triggeredAt).toLocaleString()}</p>
                  {alert.payload?.keyword && (
                    <p className="mt-1 text-xs text-primary">
                      Keyword: {String(alert.payload.keyword)} | Spike ratio: {String(alert.payload.spikeRatio ?? "-")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border/40 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">
                    {alert.severity}
                  </span>
                  {alert.status === "open" ? (
                    <button
                      onClick={() => void handleAcknowledge(alert._id)}
                      disabled={acknowledgingId === alert._id}
                      className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <span className="rounded-lg border border-border/40 px-3 py-2 text-xs font-semibold text-muted-foreground">{alert.status}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="glass-premium rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Rule</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Entities</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Channels</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Triggered</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Loading alert rules...
                  </td>
                </tr>
              )}
              {!loading && alertRules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No alert rules found for this workspace yet.
                  </td>
                </tr>
              )}
              {alertRules.map((r) => (
                <tr key={r._id} className="border-b border-border/50 transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.entityIds.length === 0 ? "All watchlist" : `${r.entityIds.length} tracked entities`}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.deliveryChannels.join(" + ")}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="rounded-full bg-nucleus-positive/15 px-2 py-0.5 text-[10px] text-nucleus-positive">{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-foreground">{triggerCounts.get(r._id) || 0} total</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PageVisualDeck
        eyebrow="Rule Activity"
        title="Alert traffic and trigger quality"
        description="The alerting layer now includes actionable keyword-spike acknowledgement alongside your existing rules."
        cards={[
          {
            kind: "line",
            title: "Spike Volume",
            value: String(spikeAlerts.length),
            subtitle: "Recent keyword spikes",
            footer: "Media intelligence alert stream",
            color: "#24c7d9",
            fill: "rgba(36, 199, 217, 0.16)",
            values: spikeAlerts.slice(0, 8).map((_, index) => spikeAlerts.length - index),
          },
          {
            kind: "bar",
            title: "Rule Count",
            value: String(alertRules.length),
            subtitle: "Configured rules",
            footer: "Current workspace coverage",
            color: "#8b5cf6",
            values: alertRules.slice(0, 8).map((rule) => triggerCounts.get(rule._id) || 0),
          },
          {
            kind: "radial",
            title: "Open Alerts",
            value: String(alerts.filter((alert) => alert.status === "open").length),
            subtitle: "Require attention",
            footer: "Acknowledgement queue",
            color: "#22c55e",
            progress: Math.min(100, alerts.filter((alert) => alert.status === "open").length * 10),
          },
        ]}
      />
    </div>
  );
}
