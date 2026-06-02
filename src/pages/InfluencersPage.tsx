import { PageVisualDeck } from "@/components/PageVisualDeck";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getInfluencerPosts, getInfluencers, type InfluencerPostRecord, type InfluencerRecord } from "@/lib/api";
import { BarChart3, Eye, Heart, MessageCircle, Search, ShieldAlert, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "@/hooks/use-toast";

const platformColors: Record<string, string> = {
  "Twitter/X": "#0ea5e9",
  Instagram: "#ec4899",
  YouTube: "#ef4444",
  TikTok: "#8b5cf6",
  LinkedIn: "#2563eb",
};

function formatCompact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<InfluencerRecord[]>([]);
  const [posts, setPosts] = useState<Record<string, InfluencerPostRecord[]>>({});
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getInfluencers({ limit: 100 })
      .then((response) => {
        if (!active) return;
        setInfluencers(response.items);
        setSelectedHandle(response.items[0]?.handle || null);
      })
      .catch((error) => {
        if (!active) return;
        toast({
          title: "Unable to load influencers",
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

  const filteredInfluencers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return influencers;
    return influencers.filter((influencer) =>
      `${influencer.name} ${influencer.handle} ${influencer.category || ""} ${influencer.niche || ""} ${influencer.geography || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [influencers, search]);

  const selected = filteredInfluencers.find((item) => item.handle === selectedHandle) || filteredInfluencers[0] || null;

  useEffect(() => {
    if (!selected || posts[selected._id]) return;

    getInfluencerPosts(selected._id)
      .then((response) => {
        setPosts((current) => ({ ...current, [selected._id]: response.items }));
      })
      .catch((error) => {
        toast({
          title: "Unable to load influencer posts",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      });
  }, [posts, selected]);

  const selectedPosts = selected ? posts[selected._id] || [] : [];
  const topInfluencers = filteredInfluencers.slice(0, 6).map((item) => ({
    name: item.name,
    followers: item.followers,
  }));
  const platformMix = selected
    ? selected.activePlatforms.map((platform, index) => ({
        name: platform,
        value: Math.max(1, 100 - index * 18),
        color: platformColors[platform] || "#94a3b8",
      }))
    : [];
  const performanceData = selectedPosts.slice(0, 6).map((post) => ({
    label: new Date(post.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    likes: post.likes,
    views: post.views,
  })).reverse();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Influencers
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Live influencer profiles and posts from the REST API.</p>
      </div>

      <PageVisualDeck
        eyebrow="Creator Visuals"
        title="Reach, platform mix, and post performance"
        description="Influencer monitoring now uses live profiles and stored creator posts."
        cards={[
          { kind: "line", title: "Creator Count", value: String(filteredInfluencers.length), subtitle: "Visible profiles", footer: "Current filtered roster", color: "#24c7d9", fill: "rgba(36, 199, 217, 0.16)", values: topInfluencers.map((item) => item.followers) },
          { kind: "bar", title: "Post Volume", value: String(selectedPosts.length), subtitle: "Loaded posts for selected creator", footer: selected?.name || "No creator selected", color: "#8b5cf6", values: performanceData.map((item) => item.likes) },
          { kind: "radial", title: "Risk Read", value: selected ? selected.riskScore.toFixed(0) : "0", subtitle: "Selected creator risk", footer: "Live profile score", color: "#f97360", progress: Math.min(100, Math.round(selected?.riskScore || 0)) },
        ]}
      />

      <div className="glass-premium rounded-2xl p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by creator, handle, niche, or geography" className="pl-10" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          {loading && <div className="glass-premium rounded-2xl p-5 text-sm text-muted-foreground">Loading influencer profiles...</div>}
          {!loading && filteredInfluencers.length === 0 && <div className="glass-premium rounded-2xl p-5 text-sm text-muted-foreground">No influencers match the current search.</div>}
          {filteredInfluencers.map((influencer) => (
            <button
              key={influencer._id}
              onClick={() => setSelectedHandle(influencer.handle)}
              className={`w-full rounded-2xl border p-5 text-left transition-all ${selected?.handle === influencer.handle ? "border-primary/35 bg-primary/10" : "border-border/40 bg-muted/20 hover:border-primary/20"}`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{influencer.name}</h3>
                  <p className="text-xs text-muted-foreground">{influencer.handle}</p>
                  <p className="mt-1 text-[11px] text-primary">{influencer.niche || influencer.category || "General creator"}</p>
                </div>
                <Badge variant="outline">{influencer.primaryPlatform}</Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><p className="text-muted-foreground">Followers</p><p className="font-semibold text-foreground">{formatCompact(influencer.followers)}</p></div>
                <div><p className="text-muted-foreground">Engagement</p><p className="font-semibold text-foreground">{influencer.engagement}%</p></div>
                <div><p className="text-muted-foreground">Reach</p><p className="font-semibold text-foreground">{formatCompact(influencer.reach)}</p></div>
                <div><p className="text-muted-foreground">Risk</p><p className="font-semibold text-foreground">{influencer.riskScore}</p></div>
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {selected ? (
            <>
              <div className="glass-premium rounded-2xl p-5">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                  <p className="text-sm text-muted-foreground">{selected.handle}</p>
                  <p className="mt-1 text-xs text-primary">{selected.geography || "Global"} - {selected.niche || selected.category || "Creator"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                  <div className="rounded-xl bg-muted/30 p-3"><span className="text-soft">Followers</span><p className="font-mono text-foreground">{selected.followers.toLocaleString()}</p></div>
                  <div className="rounded-xl bg-muted/30 p-3"><span className="text-soft">Posts</span><p className="font-mono text-foreground">{selected.posts.toLocaleString()}</p></div>
                  <div className="rounded-xl bg-muted/30 p-3"><span className="text-soft">Sentiment</span><p className="font-mono text-foreground">{selected.sentiment}</p></div>
                  <div className="rounded-xl bg-muted/30 p-3"><span className="text-soft">Risk</span><p className="font-mono text-foreground">{selected.riskScore}</p></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.activePlatforms.map((platform) => (
                    <Badge key={platform} variant="outline">{platform}</Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="glass-premium rounded-2xl p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Post Performance
                  </h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performanceData}>
                        <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} strokeDasharray="4 6" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
                        <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
                        <Tooltip />
                        <Area type="monotone" dataKey="views" stroke="#e6c36a" fill="rgba(230,195,106,0.18)" strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-premium rounded-2xl p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    Platform Mix
                  </h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={platformMix} dataKey="value" nameKey="name" innerRadius={42} outerRadius={82}>
                          {platformMix.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="glass-premium rounded-2xl p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Creator Summary
                </h3>
                <p className="text-sm text-foreground">
                  {selected.name} is strongest on <span className="font-medium">{selected.primaryPlatform}</span>, with{" "}
                  <span className="font-medium">{formatCompact(selected.followers)}</span> followers,{" "}
                  <span className="font-medium">{selected.engagement}%</span> engagement, and a risk score of{" "}
                  <span className="font-medium">{selected.riskScore}</span>.
                </p>
              </div>

              <div className="glass-premium rounded-2xl p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">Recent Posts</h3>
                <div className="space-y-3">
                  {selectedPosts.length > 0 ? (
                    selectedPosts.map((post) => (
                      <div key={post.id} className="rounded-2xl border border-border/40 bg-muted/20 p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{post.platform}</Badge>
                          {post.brand && <Badge variant="outline">{post.brand}</Badge>}
                        </div>
                        <p className="mb-3 text-sm text-foreground">{post.caption}</p>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div className="rounded-lg bg-background/40 p-2"><span className="text-soft inline-flex items-center gap-1"><Heart className="h-3 w-3" /> Likes</span><p className="font-mono text-foreground">{post.likes.toLocaleString()}</p></div>
                          <div className="rounded-lg bg-background/40 p-2"><span className="text-soft inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Comments</span><p className="font-mono text-foreground">{post.comments.toLocaleString()}</p></div>
                          <div className="rounded-lg bg-background/40 p-2"><span className="text-soft inline-flex items-center gap-1"><Eye className="h-3 w-3" /> Views</span><p className="font-mono text-foreground">{post.views.toLocaleString()}</p></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No stored posts are available for this influencer yet.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-premium rounded-2xl p-5 text-sm text-muted-foreground">Select an influencer to see profile details and posts.</div>
          )}
        </div>
      </div>
    </div>
  );
}
