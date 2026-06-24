import { useEffect, useMemo, useState } from "react";
import { FileText, Download, Video, Sparkles, MessageCircle, PlayCircle } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { PageVisualDeck } from "@/components/PageVisualDeck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createReport, getChatbotSummary, getReports, type ReportRecord } from "@/lib/api";
import { useContextChatbot } from "@/hooks/useContextChatbot";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

const briefingTrend = [
  { day: "Mon", changes: 14, risk: 8 },
  { day: "Tue", changes: 18, risk: 9 },
  { day: "Wed", changes: 23, risk: 11 },
  { day: "Thu", changes: 20, risk: 7 },
  { day: "Fri", changes: 28, risk: 13 },
  { day: "Sat", changes: 17, risk: 6 },
  { day: "Sun", changes: 21, risk: 8 },
];

const suggestedPrompts = [
  "What changed today?",
  "Show top competitors this week",
  "Summarize sentiment for Twitter/X",
  "Which influencer had highest reach?",
];

export default function ReportStudio() {
  const [chatInput, setChatInput] = useState("");
  const [videoSummary, setVideoSummary] = useState("Generate briefing to create today's video summary.");
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const {
    messages: chatHistory,
    sending: chatLoading,
    loadingHistory,
    error: chatError,
    sendMessage,
  } = useContextChatbot({
    contextType: "report",
    fallbackAssistantMessage: "Ask for a daily summary, competitor movement, or influencer signals.",
  });

  useEffect(() => {
    let active = true;

    getReports()
      .then((response) => {
        if (active) {
          setReports(response.items);
        }
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Unable to load reports",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (active) setLoadingReports(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const highlights = useMemo(
    () => [
      ["Reports", String(reports.length)],
      ["Ready Reports", String(reports.filter((report) => report.status.toLowerCase() === "ready").length)],
      ["Draft Reports", String(reports.filter((report) => report.status.toLowerCase() === "draft").length)],
      ["Latest Type", reports[0]?.type || "None yet"],
    ],
    [reports],
  );

  const generateBriefing = async () => {
    try {
      const response = await getChatbotSummary("report");
      setVideoSummary(response.summary);
    } catch {
      setVideoSummary("Unable to generate briefing right now.");
    }
  };

  const sendChat = async (message?: string) => {
    const prompt = (message ?? chatInput).trim();
    if (!prompt || chatLoading) return;
    setChatInput("");
    await sendMessage(prompt);
  };

  const addReport = async () => {
    try {
      const response = await createReport({
        title: `Workspace Report ${reports.length + 1}`,
        type: "Daily Digest",
        summary: "Created from Report Studio.",
      });
      setReports((prev) => [response.item, ...prev]);
      toast({
        title: "Report created",
        description: `${response.item.title} is now available for export.`,
      });
    } catch (error) {
      toast({
        title: "Unable to create report",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const downloadReport = (report: ReportRecord, format: "pdf" | "pptx") => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format,
            report,
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${report.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${format}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold premium-heading tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Report Studio
          </h1>
          <p className="text-sm text-soft">Daily video briefing, AI chat copilot, and export-ready intelligence reports</p>
        </div>
        <button onClick={() => void addReport()} className="gradient-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">+ New Report</button>
      </div>

      <div className="glass-premium rounded-[1.8rem] p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Delivery Workspace</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
              Turn TV, news, and media signals into export-ready briefings and daily stakeholder reports
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Report Studio is the delivery layer of the product. Use it to generate daily briefings, package intelligence into downloadable outputs, and ask the report copilot for structured summaries based on the rest of the workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/tv">Open TV Workspace</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/news">Open Newspaper</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/media-intelligence">Open Media Intelligence</Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/25 bg-background/70 px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Ready reports</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{reports.filter((report) => report.status.toLowerCase() === "ready").length}</div>
            <div className="mt-1 text-xs text-muted-foreground">Exports currently available for download</div>
          </div>
          <div className="rounded-2xl border border-border/25 bg-background/70 px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Draft pipeline</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{reports.filter((report) => report.status.toLowerCase() === "draft").length}</div>
            <div className="mt-1 text-xs text-muted-foreground">Reports still being shaped into delivery-ready outputs</div>
          </div>
          <div className="rounded-2xl border border-border/25 bg-background/70 px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">AI briefing mode</div>
            <div className="mt-2 text-lg font-semibold text-foreground">Daily Digest</div>
            <div className="mt-1 text-xs text-muted-foreground">Use the assistant and briefing generator to compress the day into a usable narrative</div>
          </div>
        </div>
      </div>

      <div className="reporting-grid grid grid-cols-2 gap-4 md:grid-cols-4">
        {highlights.map(([label, value]) => (
          <div key={label} className="glass-premium reporting-card rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wide text-soft">{label}</p>
            <p className="text-sm font-semibold text-foreground font-mono mt-1">{value}</p>
          </div>
        ))}
      </div>

      <PageVisualDeck
        eyebrow="Reporting Visuals"
        title="Production pace, risk load, and briefing health"
        description="The studio now opens with a compact visual board so report generation feels like a production console."
        cards={[
          { kind: "line", title: "Briefing Tempo", value: "28", subtitle: "Change events this week", footer: "Peaked on Friday", color: "#24c7d9", fill: "rgba(36, 199, 217, 0.16)", values: [14, 18, 23, 20, 28, 17, 21] },
          { kind: "bar", title: "Export Mix", value: "4 Ready", subtitle: "Documents in pipeline", footer: "PDF + PPTX demand", color: "#8b5cf6", values: [18, 24, 27, 31, 36, 33, 29] },
          { kind: "radial", title: "Narrative Confidence", value: "High", subtitle: "Summary quality signal", footer: "AI briefing quality gate", color: "#f97360", progress: 86 },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 chart-shell p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Video className="h-4 w-4 text-primary" /> Daily Video Briefing</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 min-h-[190px] flex items-center justify-center">
              <div className="text-center">
                <PlayCircle className="h-12 w-12 text-primary mx-auto mb-2" />
                <p className="text-sm text-foreground">Generated Briefing Preview</p>
                <p className="text-xs text-soft">Placeholder player until a media rendering endpoint is added.</p>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-primary uppercase tracking-wide">Today&apos;s highlights</p>
              <p className="text-sm text-soft">{videoSummary}</p>
              <button onClick={generateBriefing} className="h-9 px-3 rounded-lg gradient-primary text-primary-foreground text-xs inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Generate Briefing
              </button>
            </div>
          </div>
        </div>

        <div className="chart-shell p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Daily Change Highlights</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={briefingTrend}>
              <CartesianGrid stroke="hsl(222, 16%, 14%)" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(222, 24%, 9%)", border: "1px solid hsl(46, 74%, 68%, 0.25)", borderRadius: "8px", fontSize: "11px" }} />
              <Line type="monotone" dataKey="changes" stroke="#E6C36A" strokeWidth={2.4} dot={false} />
              <Line type="monotone" dataKey="risk" stroke="#EF4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 glass-premium rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Export-ready Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loadingReports && <div className="text-sm text-muted-foreground">Loading reports...</div>}
            {!loadingReports && reports.length === 0 && <div className="text-sm text-muted-foreground">No reports found yet.</div>}
            {reports.map((report) => (
              <div key={report._id} className="chart-shell p-4 hover-glow transition-colors cursor-pointer group">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{report.title}</h3>
                    <p className="text-xs text-soft mt-0.5">{report.type} - {new Date(report.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${report.status.toLowerCase() === "ready" ? "bg-nucleus-positive/15 text-nucleus-positive" : "bg-nucleus-neutral/15 text-nucleus-neutral"}`}>{report.status}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => downloadReport(report, "pdf")} className="text-[10px] bg-muted text-muted-foreground px-2 py-1 rounded hover:text-foreground transition-colors flex items-center gap-1"><Download className="h-3 w-3" /> PDF</button>
                  <button onClick={() => downloadReport(report, "pptx")} className="text-[10px] bg-muted text-muted-foreground px-2 py-1 rounded hover:text-foreground transition-colors flex items-center gap-1"><Download className="h-3 w-3" /> PPTX</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-shell p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /> Report Chatbot</h2>
          <div className="space-y-2 mb-2">
            {suggestedPrompts.map((prompt) => (
              <button key={prompt} onClick={() => void sendChat(prompt)} className="w-full text-left text-[11px] rounded-md border border-border/40 bg-muted/20 px-2 py-1.5 text-soft hover:border-primary/25">{prompt}</button>
            ))}
          </div>
          <div className="h-44 overflow-auto rounded-lg border border-border/40 bg-muted/20 p-2 space-y-2 mb-2">
            {loadingHistory && <p className="text-xs text-primary">Loading assistant history...</p>}
            {chatHistory.map((message, index) => (
              <p key={`${message.role}-${index}-${message.content}`} className={`text-xs ${message.role === "assistant" ? "text-soft" : "text-foreground"}`}>
                <span className="font-medium">{message.role === "assistant" ? "Assistant" : "You"}:</span> {message.content}
              </p>
            ))}
            {chatLoading && <p className="text-xs text-primary">Assistant is thinking...</p>}
            {chatError && <p className="text-xs text-nucleus-negative">{chatError}</p>}
          </div>
          <div className="flex gap-2">
            <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask report assistant..." className="flex-1 h-9 text-xs" />
            <Button onClick={() => void sendChat()} className="h-9 px-3 text-xs">Send</Button>
          </div>
        </div>
      </div>

      <div className="chart-shell p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Context-aware Answer Cards</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={briefingTrend}>
            <CartesianGrid stroke="hsl(222, 16%, 14%)" strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(215, 12%, 42%)" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "hsl(222, 24%, 9%)", border: "1px solid hsl(46, 74%, 68%, 0.25)", borderRadius: "8px", fontSize: "11px" }} />
            <Bar dataKey="changes" fill="#38BDF8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
