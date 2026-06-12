export default function AboutUs() {
  return (
    <div className="space-y-8 animate-fade-in">
      <section className="rounded-[2rem] border border-primary/15 gradient-hero px-6 py-10 md:px-10">
        <img src="/logo-mark.svg" alt="Nucleus" className="h-14 w-14 rounded-2xl shadow-[0_16px_36px_-20px_rgba(15,23,42,0.55)]" />
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">About Nucleus</p>
        <h1 className="mt-4 text-4xl font-bold premium-heading md:text-5xl">
          We turn fragmented public conversations into structured strategic awareness.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-soft">
          Nucleus is designed for organizations that need a complete overview of narratives, media momentum, and competitive
          movement without compromising access control. Teams can evaluate the platform publicly, then unlock protected
          intelligence views only after authentication.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Mission", "Turn noise into measurable intelligence that decision-makers can use quickly."],
          ["Approach", "Combine AI summaries, narrative mapping, competitor tracking, and role-aware access control."],
          ["Promise", "Show the product clearly before login while keeping sensitive dashboard data protected."],
        ].map(([title, text]) => (
          <div key={title} className="glass-premium rounded-[1.75rem] p-6">
            <h2 className="mb-2 font-semibold text-foreground">{title}</h2>
            <p className="text-sm leading-7 text-soft">{text}</p>
          </div>
        ))}
      </div>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="chart-shell p-6">
          <h2 className="text-2xl font-semibold text-foreground">What the platform covers</h2>
          <div className="mt-5 grid gap-3">
            {[
              "Brand and narrative monitoring across digital and broadcast ecosystems.",
              "Competitor benchmarking and stakeholder awareness mapped to your company context.",
              "Crisis preparation, executive reporting, and AI-assisted investigation workflows.",
              "Secure onboarding so only authenticated users can move into the live data environment.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-sm leading-7 text-soft">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-premium rounded-[1.75rem] p-6">
          <h2 className="text-2xl font-semibold text-foreground">Who we support</h2>
          <div className="mt-5 space-y-4">
            {[
              ["Corporate Communications", "Understand the narrative before it sets in public perception."],
              ["Strategy & Insights", "Benchmark market movement, sentiment shifts, and competitor momentum."],
              ["Risk Operations", "Detect early warning signs and give response teams a clearer operating picture."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-border/50 bg-background/25 p-4">
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-soft">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
