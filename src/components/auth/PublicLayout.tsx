import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";

const links = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Contact Us", to: "/contact" },
];

const megaMenuModules = {
  Products: [
    { title: "Brand Tracking", text: "Get a clear picture of what customers really think about your brand.", icon: "O O O" },
    { title: "Segmentation", text: "Use audience clusters to tailor messaging and target specific groups.", icon: "[] [] o" },
    { title: "Audience Profile", text: "Turn deep audience data into smarter business and campaign decisions.", icon: "o [] o" },
  ],
  Services: [
    { title: "Reputation Monitoring", text: "Track narrative pressure in real time across social, news, and broadcast.", icon: "O /\\ O" },
    { title: "Crisis Alerts", text: "Receive instant warnings when high-risk topics begin to accelerate.", icon: "[] ! []" },
    { title: "Response Guidance", text: "Create faster, better-aligned responses with AI-assisted context.", icon: "o -> o" },
  ],
  Solutions: [
    { title: "Command Center", text: "Centralize brand, competitor, and narrative movement in one secure view.", icon: "[] [] []" },
    { title: "Executive Briefings", text: "Generate leadership-ready summaries with clear action points.", icon: "O [] /\\" },
    { title: "Campaign Intelligence", text: "Measure campaign lift, sentiment outcomes, and competitor reaction.", icon: "o o []" },
  ],
  Resources: [
    { title: "Case Studies", text: "See how teams use Nucleus to improve brand outcomes and response speed.", icon: "[] O []" },
    { title: "Guides", text: "Learn best practices for monitoring, escalation, and reporting workflows.", icon: "/\\ [] /\\" },
    { title: "Playbooks", text: "Adopt proven frameworks for crisis, campaign, and reputation scenarios.", icon: "O [] O" },
  ],
  Pricing: [
    { title: "Starter", text: "For lean teams beginning structured media and sentiment monitoring.", icon: "$ []" },
    { title: "Growth", text: "For organizations needing richer workflows, roles, and reporting depth.", icon: "$$ O" },
    { title: "Enterprise", text: "For advanced teams requiring scale, governance, and custom onboarding.", icon: "$$$ []" },
  ],
} as const;

export function PublicLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isHome = pathname === "/";
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [activeMegaTab, setActiveMegaTab] = useState<keyof typeof megaMenuModules>("Products");
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const menuItems = Object.keys(megaMenuModules) as Array<keyof typeof megaMenuModules>;

  useEffect(() => {
    setMegaMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!megaMenuRef.current) return;
      if (!megaMenuRef.current.contains(event.target as Node)) {
        setMegaMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className="min-h-screen before-login-theme bg-noise text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="floating-orb absolute left-[-5rem] top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="floating-orb-delayed absolute right-[-4rem] top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-[34rem] aurora-mesh opacity-70" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 glass-strong scanline shadow-[0_12px_34px_-30px_rgba(15,23,42,0.55)] backdrop-blur-xl">
        <div className="flex h-16 w-full items-center justify-between px-4 md:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="Nucleus" className="h-9 w-9 rounded-2xl shadow-[0_10px_28px_-18px_rgba(15,23,42,0.5)]" />
            <span>
              <span className="block font-display text-sm font-bold tracking-[0.28em] premium-heading">NUCLEUS</span>
              <span className="block text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">Media Intelligence</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              to="/"
              className={`rounded-lg px-3 py-2 text-sm transition-all ${
                pathname === "/" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              Home
            </Link>
            <Link
              to="/about"
              className={`rounded-lg px-3 py-2 text-sm transition-all ${
                pathname === "/about" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              About Us
            </Link>

            {menuItems.map((item) => (
              <button
                key={item}
                onClick={() => {
                  if (megaMenuOpen && activeMegaTab === item) {
                    setMegaMenuOpen(false);
                  } else {
                    setActiveMegaTab(item);
                    setMegaMenuOpen(true);
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-all ${
                  megaMenuOpen && activeMegaTab === item ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                {item}
                <ChevronDown className={`h-4 w-4 transition-transform ${megaMenuOpen && activeMegaTab === item ? "rotate-180" : ""}`} />
              </button>
            ))}

            <Link
              to="/contact"
              className={`rounded-lg px-3 py-2 text-sm transition-all ${
                pathname === "/contact" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              Contact Us
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="interactive-surface flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button variant="outline" className="interactive-surface hidden h-10 rounded-xl border-white/10 bg-white/5 px-4 sm:inline-flex" onClick={() => navigate("/login")}>
              Login
            </Button>
            <Button className="interactive-surface h-10 rounded-xl px-4 gradient-primary text-primary-foreground" onClick={() => navigate("/signup")}>
              Get Started
            </Button>
          </div>
        </div>

        {megaMenuOpen && (
          <div ref={megaMenuRef} className="absolute inset-x-0 top-full z-40 px-4 pb-3 md:px-6 lg:px-8">
            <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[1.9rem] border border-border/70 bg-[linear-gradient(180deg,#fffaf4_0%,#f6f1ea_100%)] shadow-[0_28px_64px_-36px_rgba(15,23,42,0.45)]">
              <div className="border-b border-border/70 px-4 py-3 md:px-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{activeMegaTab}</p>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-3 md:p-6">
                {megaMenuModules[activeMegaTab].map((item) => (
                  <div key={item.title} className="rounded-[1.3rem] border border-border/60 bg-white/75 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]">
                    <h3 className="text-2xl font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{item.text}</p>
                    <div className="mt-5 rounded-[1rem] border border-border/70 bg-[#edf1f7] px-4 py-6 text-center font-mono text-2xl tracking-widest text-slate-700">
                      {item.icon}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className={isHome ? "relative z-10 w-full px-0 py-0" : "relative z-10 mx-auto max-w-7xl px-5 py-8 md:py-10"}>
        <div className="platform-canvas">
        <Outlet />
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-background/50 backdrop-blur-xl">
        <div className="flex w-full flex-col gap-5 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="Nucleus" className="h-9 w-9 rounded-2xl shadow-[0_10px_28px_-18px_rgba(15,23,42,0.5)]" />
            <div>
              <p className="font-display text-sm font-bold tracking-[0.24em] premium-heading">NUCLEUS</p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">Media Intelligence</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {links.map((link) => (
              <Link key={link.to} to={link.to} className="hover:text-foreground transition-colors">
                {link.label}
              </Link>
            ))}
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>

          <p className="text-xs text-muted-foreground/75">Protected insights unlock after secure signup or login.</p>
        </div>
      </footer>
    </div>
  );
}
