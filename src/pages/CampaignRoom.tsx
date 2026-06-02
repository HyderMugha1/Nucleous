import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { PageVisualDeck } from "@/components/PageVisualDeck";
import { createCampaign, getCampaigns, type CampaignRecord } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export default function CampaignRoom() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getCampaigns()
      .then((response) => {
        if (active) {
          setCampaigns(response.items);
        }
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Unable to load campaigns",
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

  const addCampaign = async () => {
    try {
      const response = await createCampaign({
        name: `Campaign ${campaigns.length + 1}`,
        description: "Created from the campaign room.",
        goal: "Track campaign momentum and sentiment.",
      });
      setCampaigns((prev) => [response.item, ...prev]);
      toast({
        title: "Campaign created",
        description: `${response.item.name} is now available in Campaign Room.`,
      });
    } catch (error) {
      toast({
        title: "Unable to create campaign",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Campaign Room
          </h1>
          <p className="text-sm text-muted-foreground">Track and measure PR campaign performance</p>
        </div>
        <button
          onClick={() => void addCampaign()}
          className="gradient-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + New Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {loading && <div className="text-sm text-muted-foreground">Loading campaigns...</div>}
        {!loading && campaigns.length === 0 && <div className="text-sm text-muted-foreground">No campaigns found yet.</div>}
        {campaigns.map((campaign) => (
          <div key={campaign._id} className="glass-premium interactive-surface rounded-lg p-5 cursor-pointer group">
            <div className="mb-3 flex items-start justify-between">
              <h3 className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">{campaign.name}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${campaign.status === "active" ? "bg-nucleus-positive/15 text-nucleus-positive" : "bg-muted text-muted-foreground"}`}>
                {campaign.status}
              </span>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Mentions</p>
                <p className="text-lg font-bold font-mono text-foreground">{String(campaign.kpis?.mentions ?? 0)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Sentiment</p>
                <p className="text-lg font-bold font-mono text-nucleus-positive">{String(campaign.kpis?.sentiment ?? "Pending")}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Period</p>
                <p className="mt-1 text-xs text-foreground">
                  {new Date(campaign.startDate).toLocaleDateString()} - {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : "Ongoing"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <PageVisualDeck
        eyebrow="Campaign Visuals"
        title="Momentum, conversion, and message health"
        description="Each campaign screen now gets an at-a-glance visual board so performance is easier to scan before diving into detail."
        cards={[
          { kind: "line", title: "Reach Curve", value: "218K", subtitle: "Media pickup this week", footer: "+18% vs prior cycle", color: "#24c7d9", fill: "rgba(36, 199, 217, 0.16)", values: [18, 22, 28, 31, 46, 52, 49, 64] },
          { kind: "bar", title: "Engagement Mix", value: "72%", subtitle: "Audience response density", footer: "Owned + earned channels", color: "#8b5cf6", values: [32, 44, 41, 56, 63, 58, 67] },
          { kind: "radial", title: "Brand Lift", value: "Positive", subtitle: "Campaign sentiment efficiency", footer: "Health threshold maintained", color: "#f97360", progress: 74 },
        ]}
      />
    </div>
  );
}
