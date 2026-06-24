import {
  LayoutDashboard,
  Search,
  Network,
  Users,
  Swords,
  Megaphone,
  ShieldAlert,
  FileText,
  Settings,
  Zap,
  Home,
  Star,
  Tv,
  Newspaper,
  Radar,
  Eye,
  Bell,
  Database,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Home", url: "/home", icon: Home },
  { title: "Command Center", url: "/dashboard", icon: LayoutDashboard },
  { title: "Mention Explorer", url: "/mentions", icon: Search },
  { title: "Narrative Explorer", url: "/narratives", icon: Network },
  { title: "Influencers", url: "/influencers", icon: Star },
  { title: "TV", url: "/tv", icon: Tv },
  { title: "Newspaper", url: "/news", icon: Newspaper },
  { title: "Media Intelligence", url: "/media-intelligence", icon: Radar },
  { title: "Branding Monitor", url: "/media-intelligence/branding", icon: Eye },
];

const actionNav = [
  { title: "Competition Analysis", url: "/entities", icon: Users },
  { title: "Competitor Bench", url: "/competitors", icon: Swords },
  { title: "Campaign Room", url: "/campaigns", icon: Megaphone },
  { title: "Crisis Room", url: "/crisis", icon: ShieldAlert },
  { title: "Report Studio", url: "/reports", icon: FileText },
];

const systemNav = [
  { title: "Alerts & Rules", url: "/alerts", icon: Bell },
  { title: "Supabase Test", url: "/supabase-test", icon: Database },
  { title: "Admin", url: "/admin", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const renderGroup = (label: string, items: typeof mainNav) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.26em] text-muted-foreground/55">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url === "/dashboard" || item.url === "/home"}
                  className="group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-accent/10 hover:text-foreground hover:shadow-[0_0_18px_-10px_rgba(36,199,217,0.35)]"
                  activeClassName="border border-primary/25 bg-primary/12 font-semibold text-primary shadow-[0_0_18px_-8px_rgba(249,115,96,0.5)]"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border/70 bg-card/95 px-2 py-1 text-[11px] font-medium text-foreground opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100">
                      {item.title}
                    </span>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60 bg-[linear-gradient(180deg,rgba(255,252,248,0.94),rgba(243,236,228,0.96))]">
      <SidebarHeader className="p-4">
        <div className="rounded-[1.3rem] border border-white/60 bg-white/45 p-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.3)]">
          <div className="flex items-center gap-2.5">
            <img src="/logo-mark.svg" alt="Nucleus" className="h-9 w-9 rounded-xl shadow-[0_10px_28px_-18px_rgba(15,23,42,0.5)]" />
            {!collapsed && (
              <div>
                <h1 className="text-sm font-extrabold tracking-[-0.04em] text-foreground">NUCLEUS</h1>
                <p className="text-[9px] font-semibold tracking-[0.24em] text-muted-foreground/50">MEDIA INTELLIGENCE</p>
              </div>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {renderGroup("Intelligence", mainNav)}
        {renderGroup("Action", actionNav)}
        {renderGroup("System", systemNav)}
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && <div className="text-[10px] font-medium text-muted-foreground/40">v1.0 | Powered by AI</div>}
      </SidebarFooter>
    </Sidebar>
  );
}
