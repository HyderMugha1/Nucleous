export default function OurTechnology() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold premium-heading">Our Technology</h1>
      <p className="text-soft max-w-3xl">
        Our stack combines NLP, sentiment scoring, clustering, influencer graph analysis, and predictive narrative models.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {[
          ["Narrative Engine", "Detects rising themes and maps their trajectory across channels."],
          ["Sentiment Intelligence", "Aggregates sentiment by topic, platform, and influencer segment."],
          ["Engagement Graph", "Ranks mentions and profiles by likes, shares, comments, and velocity."],
          ["AI Copilot", "Generates summaries and supports context-aware chat queries."],
        ].map(([title, text]) => (
          <div key={title} className="chart-shell p-5">
            <h2 className="font-semibold text-foreground mb-2">{title}</h2>
            <p className="text-sm text-soft">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
