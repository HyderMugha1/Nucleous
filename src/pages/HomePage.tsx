import { ArrowRight, BarChart3, LockKeyhole, Radar, Sparkles, TrendingUp, Users, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const features = [
  {
    icon: Radar,
    title: "Command Center",
    text: "A protected intelligence layer for signals, summaries, and high-priority movement.",
  },
  {
    icon: Waves,
    title: "Narrative Intelligence",
    text: "Track how conversations build momentum and understand why a topic is accelerating.",
  },
  {
    icon: Users,
    title: "Competitor Watch",
    text: "Keep competitor movement, audience reaction, and market positioning in one secure workspace.",
  },
];

const securePoints = [
  "The interface can be explored before login, but the operational data stays hidden.",
  "Signup captures company context, contact number, and competitors for onboarding.",
  "Login unlocks the protected workspace and routes the user into the product.",
];

const useCases = [
  "Leadership teams get a premium overview before unlocking sensitive dashboards.",
  "Marketing teams can see how the product supports campaigns, sentiment, and competitor movement.",
  "Risk teams can move into a secure workspace once authentication is complete.",
];

const trendPanels = [
  { title: "Volume", value: "448", points: [24, 58, 76, 51, 49, 47, 68, 43, 18], stroke: "#24c7d9", fill: "rgba(36, 199, 217, 0.14)" },
  { title: "Momentum", value: "589", points: [18, 31, 62, 66, 70, 46, 72, 38, 22], stroke: "#8b5cf6", fill: "rgba(139, 92, 246, 0.14)" },
  { title: "Amplify", value: "678", points: [21, 40, 39, 68, 52, 28, 41, 22, 14], stroke: "#ec4899", fill: "rgba(236, 72, 153, 0.14)" },
];

const ringStats = [
  { label: "Brand heat", value: 75, color: "#24c7d9" },
  { label: "Audience trust", value: 82, color: "#8b5cf6" },
  { label: "Channel lift", value: 65, color: "#3b82f6" },
];

const distributionBars = [44, 28, 56, 34, 61, 37, 49, 31, 58];
const waveSeries = [46, 58, 43, 29, 36, 22, 31, 26, 48];
const pulseSeries = [14, 20, 18, 28, 25, 22, 30, 34, 29, 26, 35];

function buildLinePath(values: number[], width: number, height: number) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[], width: number, height: number) {
  return `${buildLinePath(values, width, height)} L ${width} ${height} L 0 ${height} Z`;
}

function SparklinePanel({
  title,
  value,
  points,
  stroke,
  fill,
}: {
  title: string;
  value: string;
  points: number[];
  stroke: string;
  fill: string;
}) {
  const width = 220;
  const height = 84;
  const linePath = buildLinePath(points, width, height);
  const areaPath = buildAreaPath(points, width, height);

  return (
    <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/85 p-4 shadow-[0_12px_40px_-32px_rgba(15,23,42,0.4)]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">{title}</p>
        <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white">{value}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-24 w-full overflow-visible">
        <defs>
          <linearGradient id={`fill-${title}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#fill-${title})`} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => {
          const max = Math.max(...points);
          const min = Math.min(...points);
          const range = Math.max(max - min, 1);
          const x = (index / (points.length - 1)) * width;
          const y = height - ((point - min) / range) * (height - 8) - 4;
          return (
            <circle key={`${title}-${index}`} cx={x} cy={y} r="5" fill="#ffffff" stroke={stroke} strokeWidth="3" />
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300">
        {["01", "03", "05", "07", "09"].map((label) => (
          <span key={`${title}-${label}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function RingStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[1.3rem] border border-slate-200/80 bg-white/90 p-4 text-center">
      <div
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${color} ${value}%, rgba(226, 232, 240, 0.95) ${value}% 100%)`,
        }}
      >
        <div className="flex h-[4.1rem] w-[4.1rem] items-center justify-center rounded-full bg-[#fffaf6] text-lg font-semibold text-slate-900">
          {value}%
        </div>
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
    </div>
  );
}

function EditorialDashboardPreview() {
  const waveWidth = 360;
  const waveHeight = 180;

  return (
    <div className="relative overflow-hidden rounded-[1.85rem] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(249,245,239,0.92))] p-4 shadow-[0_32px_80px_-48px_rgba(15,23,42,0.55)] md:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,96,0.1),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(34,193,195,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.4),transparent_40%)]" />

      <div className="relative flex items-center justify-between rounded-[1.4rem] border border-slate-200/80 bg-white/75 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Protected Workspace Preview</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">Signal board styled to your brand palette.</h3>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <LockKeyhole className="h-3.5 w-3.5" />
          Secure View
        </div>
      </div>

      <div className="relative mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {trendPanels.map((panel) => (
              <SparklinePanel key={panel.title} {...panel} />
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[1.65rem] border border-slate-200/80 bg-white/85 p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-slate-900">Signal Quality</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {ringStats.map((stat) => (
                  <RingStat key={stat.label} {...stat} />
                ))}
              </div>
            </div>

            <div className="rounded-[1.65rem] border border-slate-200/80 bg-white/85 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Scens</p>
                  <h4 className="mt-1 text-base font-semibold text-slate-950">Monthly response spread</h4>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">Live</span>
              </div>
              <div className="mt-5 flex h-40 items-end gap-3">
                {distributionBars.map((height, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-2">
                    <div className="relative flex h-full w-full items-end justify-center rounded-full bg-slate-100/90 px-1.5 pb-1.5">
                      <div
                        className="w-full rounded-full bg-[linear-gradient(180deg,#24c7d9_0%,#8b5cf6_100%)]"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-300">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.65rem] border border-slate-200/80 bg-white/85 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Choro</p>
                <h4 className="mt-1 text-base font-semibold text-slate-950">Narrative movement</h4>
              </div>
              <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white">6,208</span>
            </div>
            <svg viewBox={`0 0 ${waveWidth} ${waveHeight}`} className="mt-5 h-44 w-full">
              <defs>
                <linearGradient id="wave-a" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(36,199,217,0.85)" />
                  <stop offset="100%" stopColor="rgba(36,199,217,0.12)" />
                </linearGradient>
                <linearGradient id="wave-b" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(139,92,246,0.7)" />
                  <stop offset="100%" stopColor="rgba(139,92,246,0.1)" />
                </linearGradient>
              </defs>
              <path d={buildAreaPath(waveSeries, waveWidth, waveHeight - 10)} fill="url(#wave-a)" transform="translate(0 10)" />
              <path d={buildAreaPath(waveSeries.map((value, index) => value - 8 + (index % 3) * 4), waveWidth, waveHeight - 28)} fill="url(#wave-b)" transform="translate(0 28)" />
            </svg>
          </div>

          <div className="rounded-[1.65rem] border border-slate-200/80 bg-white/85 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Top Signals</p>
                <h4 className="mt-1 text-base font-semibold text-slate-950">Priority channels</h4>
              </div>
              <span className="text-xs font-medium text-slate-400">Updated 2m ago</span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["Choro vocibus adolescents", "8.375"],
                ["An ferri latine usex ex primis", "6.386"],
                ["Primis tritani choro vocibus", "7.034"],
              ].map(([label, value], index) => (
                <div key={label} className="flex items-center gap-3 rounded-[1.1rem] bg-[#faf6f1] px-3 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((dot) => (
                      <span
                        key={dot}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: dot <= index + 1 ? "#24c7d9" : "#dbe4ec" }}
                      />
                    ))}
                  </div>
                  <span className="flex-1 text-sm text-slate-600">{label}</span>
                  <span className="text-sm font-semibold text-slate-950">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-end gap-2">
              {pulseSeries.map((height, index) => (
                <div key={index} className="flex-1 rounded-full bg-slate-100 p-[3px]">
                  <div
                    className="rounded-full bg-[linear-gradient(180deg,#8b5cf6_0%,#60a5fa_100%)]"
                    style={{ height: `${height * 1.8}px` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-3 rounded-[1.3rem] border border-slate-200/70 bg-white/70 px-4 py-3 text-xs text-slate-500">
        <span className="rounded-full bg-[#fff3ee] px-3 py-1 font-medium text-primary">Volume +14.2%</span>
        <span className="rounded-full bg-[#eefbfd] px-3 py-1 font-medium text-[#1497ab]">Sentiment recovery in broadcast</span>
        <span className="rounded-full bg-[#f3efff] px-3 py-1 font-medium text-[#7c3aed]">Competitor watchlist refreshed</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="relative overflow-hidden before-login-theme">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="floating-orb absolute left-[-6rem] top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="floating-orb-delayed absolute right-[-4rem] top-20 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-[46rem] aurora-mesh opacity-80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.04),transparent_28%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-6 md:pb-20 md:pt-10 lg:px-8">
        <section className="relative flex min-h-[72vh] items-center justify-center py-8 md:py-12">
          <div className="relative mx-auto w-full max-w-[1160px] overflow-hidden rounded-[2.2rem] border border-white/30 shadow-[0_45px_90px_-52px_rgba(15,23,42,0.55)]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'url("/images/after-login-hero-bg.jpg")',
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.54),rgba(2,6,23,0.36),rgba(2,6,23,0.56))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.14),transparent_42%),radial-gradient(circle_at_84%_20%,rgba(236,72,153,0.16),transparent_38%)]" />

            <div className="relative z-10 w-full px-6 py-14 md:px-10 md:py-16">
              <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/25 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/85 backdrop-blur-sm">
                  <img src="/logo-mark.svg" alt="Nucleus" className="h-5 w-5 rounded-lg" />
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse-soft" />
                  Before Login Experience
                </div>

                <h1 className="mt-8 max-w-5xl text-4xl font-bold leading-[0.98] text-white drop-shadow-[0_10px_28px_rgba(2,6,23,0.65)] md:text-6xl xl:text-[4.35rem]">
                  See the intelligence story.
                  <span className="mt-3 block bg-gradient-to-r from-[#f97360] via-[#ec4899] to-[#8b5cf6] bg-clip-text text-transparent">
                    Unlock the live workspace after login.
                  </span>
                </h1>

                <p className="mt-7 max-w-2xl text-base leading-8 text-white/86 md:text-lg">
                  Nucleus introduces the platform with richer editorial-style analytics visuals and stronger typography,
                  while protected operational data stays secured behind authentication.
                </p>

                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                  <Button className="h-12 rounded-2xl px-6 gradient-primary text-primary-foreground glow-primary" onClick={() => navigate("/signup")}>
                    Create Secure Account
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 rounded-2xl border-white/45 bg-black/20 px-6 text-white hover:bg-black/35 hover:text-white"
                    onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                  >
                    {isAuthenticated ? "Open Workspace" : "Login to Unlock"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 md:mt-10">
          <div className="grid gap-6 xl:grid-cols-[1.16fr_0.84fr]">
            <div className="relative">
              <div className="absolute inset-0 rounded-[2rem] bg-primary/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-[linear-gradient(160deg,rgba(255,255,255,0.72),rgba(244,237,229,0.92))] p-5 shadow-[0_35px_100px_-55px_rgba(15,23,42,0.32)]">
                <EditorialDashboardPreview />
              </div>
            </div>

            <div className="glass-premium rounded-[2rem] p-7 md:p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
                <LockKeyhole className="h-3.5 w-3.5" />
                Secure Access Model
              </div>

              <h2 className="mt-5 text-3xl font-semibold leading-tight text-foreground">
                Visuals can feel alive
                <span className="block text-soft">without exposing the protected analytics layer.</span>
              </h2>

              <p className="mt-5 text-sm leading-7 text-muted-foreground">
                The new graph language borrows the rhythm of your reference image, then adapts it to the platform’s own
                palette and premium product identity instead of copying that look literally.
              </p>

              <div className="mt-7 space-y-3">
                {securePoints.map((item) => (
                  <div key={item} className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                    <p className="text-sm leading-7 text-soft">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 md:mt-16">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Platform Overview</p>
            <h2 className="mt-3 text-3xl font-semibold text-foreground">A clearer, more expressive view of what Nucleus offers.</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="glass-premium rounded-[1.8rem] p-6 md:p-7 hover-lift">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-soft">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-[2rem] border border-primary/15 bg-[linear-gradient(130deg,rgba(249,115,96,0.14),rgba(34,193,195,0.08),rgba(20,32,51,0.85))] p-8 md:mt-16 md:p-10">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-200/80">Who It Helps</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Sharper typography, calmer contrast, stronger hierarchy.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-200/80">
                The updated system makes headings more memorable, charts easier to scan, and the overall platform more
                polished on both marketing and logged-in product screens.
              </p>
            </div>

            <div className="space-y-3">
              {useCases.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[1.4rem] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                  <TrendingUp className="mt-0.5 h-4 w-4 text-[#7fe7f3]" />
                  <p className="text-sm leading-7 text-slate-100/90">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-14 pb-4 text-center md:mt-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Ready To Continue</p>
          <h2 className="mt-3 text-3xl font-semibold text-foreground md:text-4xl">Explore the platform now. Unlock the workspace when you're ready.</h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button className="h-12 rounded-2xl gradient-primary px-6 text-primary-foreground" onClick={() => navigate("/signup")}>
              Sign Up With Company Details
            </Button>
            <Button variant="outline" className="h-12 rounded-2xl border-primary/30 bg-background/20 px-6 text-primary hover:bg-primary/10" onClick={() => navigate("/about")}>
              Learn More
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
