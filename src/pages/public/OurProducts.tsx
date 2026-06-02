export default function OurProducts() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold premium-heading">Our Products</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          ["Command Center", "Unified intelligence dashboard for real-time monitoring."],
          ["Mention Explorer", "Deep filtering, top mentions, and profile tracking."],
          ["Narrative Explorer", "Narrative drill-down, trend trajectory, and sentiment."],
          ["Competition Analysis", "Competitor performance, platform sentiment, and influencer impact."],
          ["Influencer Insights", "Rankings, detail profiles, top topics, and content analysis."],
          ["Report Studio", "Executive-ready snapshots and exportable reports."],
        ].map(([title, text]) => (
          <div key={title} className="glass-premium rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-2">{title}</h2>
            <p className="text-sm text-soft">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
