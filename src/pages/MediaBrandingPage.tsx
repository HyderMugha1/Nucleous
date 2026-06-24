import { Eye, Radar } from "lucide-react";
import { WebPaperCrawlerPanel } from "@/components/news/WebPaperCrawlerPanel";

export default function MediaBrandingPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Eye className="h-6 w-6 text-primary" />
          Branding Monitor
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full-screen ad visibility, sponsored placement monitoring, and screenshot review for connected news websites.
        </p>
      </div>

      <div className="glass-premium rounded-[1.9rem] p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Media Intelligence</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
              Review real brand placements, page evidence, and scan history in one workspace
            </h2>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
              This workspace is focused only on branding screenshots and ad detections. It uses the news websites and synced article URLs already stored on your platform, then surfaces gallery, table, scan, and export views without burying them inside nested modals.
            </p>
          </div>

          <div className="rounded-2xl border border-border/25 bg-background/60 px-4 py-4 text-sm text-muted-foreground xl:max-w-sm">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Radar className="h-4 w-4 text-primary" />
              Workflow
            </div>
            <div className="mt-3 space-y-2">
              <p>1. Select a publisher from your connected websites.</p>
              <p>2. Send the bot to scan stored article URLs first.</p>
              <p>3. Review screenshots, detections, failures, and exports here.</p>
            </div>
          </div>
        </div>
      </div>

      <WebPaperCrawlerPanel initialTab="websites" mode="branding" />
    </div>
  );
}
