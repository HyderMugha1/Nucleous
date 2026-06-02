import { ReactNode, useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Sparkles, Command, BrainCircuit, Siren, LayoutGrid, Moon, Sun } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { toast } from "@/hooks/use-toast";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  const navActions = useMemo(
    () => [
      { label: "Home", path: "/home", icon: LayoutGrid },
      { label: "Command Center", path: "/dashboard", icon: BrainCircuit },
      { label: "Mention Explorer", path: "/mentions", icon: Sparkles },
      { label: "Narrative Monitor", path: "/narratives", icon: Siren },
      { label: "Media Intelligence", path: "/media-intelligence", icon: Sparkles },
      { label: "Competitor Bench", path: "/competitors", icon: LayoutGrid },
      { label: "Report Studio", path: "/reports", icon: Sparkles },
    ],
    [],
  );

  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full relative bg-noise">
        <div className="cursor-glow hidden lg:block" style={{ left: cursor.x, top: cursor.y }} />

        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <header className="sticky top-0 z-30 flex h-[4.25rem] items-center gap-3 border-b border-border/60 bg-[linear-gradient(180deg,rgba(255,252,248,0.95),rgba(246,240,232,0.88))] px-4 backdrop-blur-xl scanline shadow-[0_14px_34px_-30px_rgba(15,23,42,0.55)]">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />

            <div className="flex-1 flex justify-center">
              <div className="w-full max-w-2xl">
                <GlobalSearch />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpen(true)}
                className="interactive-surface flex h-10 items-center gap-1.5 rounded-2xl border border-primary/25 bg-primary/10 px-3.5 text-xs font-semibold text-primary hover:bg-primary/15"
              >
                <Command className="h-3.5 w-3.5" />
                AI Actions
              </button>

              <button
                onClick={() => navigate("/alerts")}
                className="interactive-surface relative flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-white/72 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse-soft" />
              </button>
              <button
                onClick={toggleTheme}
                className="interactive-surface flex h-10 w-10 items-center justify-center rounded-2xl border border-border/50 bg-white/72 text-muted-foreground hover:text-foreground"
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground glow-primary-sm">
                N
              </div>
              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="interactive-surface h-10 rounded-2xl border border-border/50 px-3.5 text-xs font-semibold text-muted-foreground hover:border-primary/35 hover:text-foreground"
              >
                Logout
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-5 md:p-6">
            <div className="platform-canvas mx-auto w-full max-w-[1580px]">{children}</div>
          </main>
        </div>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search insights, entities, trends..." />
        <CommandList>
          <CommandEmpty>No matching commands found.</CommandEmpty>

          <CommandGroup heading="Navigate">
            {navActions.map((item) => (
              <CommandItem
                key={item.label}
                onSelect={() => {
                  navigate(item.path);
                  setOpen(false);
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                {location.pathname === item.path && <CommandShortcut>Active</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="AI Quick Actions">
            <CommandItem
              onSelect={() => {
                setOpen(false);
                navigate("/dashboard");
                toast({
                  title: "Opening command center AI context",
                  description: "You can now ask why Jazz is trending from the dashboard chatbot.",
                });
              }}
            >
              <Sparkles className="mr-2 h-4 w-4 text-primary" />
              Explain why Jazz is trending now
              <CommandShortcut>AI</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                navigate("/dashboard");
                toast({
                  title: "Narrative risk workflow ready",
                  description: "Use the dashboard assistant to summarize the last 24 hours of narrative risk.",
                });
              }}
            >
              <BrainCircuit className="mr-2 h-4 w-4 text-nucleus-positive" />
              Summarize narrative risks from the last 24 hours
              <CommandShortcut>AI</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                navigate("/crisis");
                toast({
                  title: "Crisis workspace opened",
                  description: "Review active incidents and response guidance from the crisis page.",
                });
              }}
            >
              <Siren className="mr-2 h-4 w-4 text-nucleus-negative" />
              Generate crisis response recommendations
              <CommandShortcut>AI</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </SidebarProvider>
  );
}
