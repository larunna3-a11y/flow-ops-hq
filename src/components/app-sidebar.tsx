import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PackageCheck,
  ScanLine,
  RotateCcw,
  BarChart3,
  Users,
  Settings,
  Boxes,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { workspace } from "@/lib/mock-data";

const operations = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Packing", url: "/packing", icon: PackageCheck },
  { title: "Scan Tracking", url: "/scanning", icon: ScanLine },
  { title: "Returns", url: "/returns", icon: RotateCcw },
];

const insights = [
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const admin = [
  { title: "Users", url: "/users", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const renderGroup = (label: string, items: typeof operations) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant">
            <Boxes className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">FlowOps</span>
              <span className="text-[11px] text-muted-foreground truncate">{workspace.name}</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("Operations", operations)}
        {renderGroup("Insights", insights)}
        {renderGroup("Workspace", admin)}
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && (
          <div className="rounded-md border bg-card p-3 text-xs">
            <div className="font-medium text-foreground">{workspace.plan} plan</div>
            <div className="mt-0.5 text-muted-foreground">{workspace.members} members</div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
