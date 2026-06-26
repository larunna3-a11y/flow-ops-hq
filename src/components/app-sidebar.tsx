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
  Store,
  ShoppingCart,
  Plug,
  History,
} from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { useWorkspace } from "@/lib/use-workspace";
import { canAccess, type ModuleKey } from "@/lib/permissions";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");
  const { t } = useTranslation();
  const { data: ws } = useWorkspace();
  const role = ws?.role ?? null;
  const allow = (m: ModuleKey) => (role ? canAccess(role, m) : true);

  const operations = [
    { title: t("sidebar.items.dashboard"), url: "/dashboard", icon: LayoutDashboard, m: "dashboard" as const },
    { title: t("sidebar.items.orders"), url: "/orders", icon: ShoppingCart, m: "orders" as const },
    { title: t("sidebar.items.packing"), url: "/packing", icon: PackageCheck, m: "packing" as const },
    { title: t("sidebar.items.scanning"), url: "/scanning", icon: ScanLine, m: "scanning" as const },
    { title: t("sidebar.items.returns"), url: "/returns", icon: RotateCcw, m: "returns" as const },
  ].filter((i) => allow(i.m));

  const insights = [
    { title: t("sidebar.items.reports"), url: "/reports", icon: BarChart3, m: "reports" as const },
    { title: t("sidebar.items.imports"), url: "/imports", icon: History, m: "imports" as const },
  ].filter((i) => allow(i.m));

  const admin = [
    { title: t("sidebar.items.stores"), url: "/stores", icon: Store, m: "stores" as const },
    { title: t("sidebar.items.marketplace"), url: "/marketplace", icon: Plug, m: "marketplace" as const },
    { title: t("sidebar.items.users"), url: "/users", icon: Users, m: "users" as const },
    { title: t("sidebar.items.settings"), url: "/settings", icon: Settings, m: "settings" as const },
  ].filter((i) => allow(i.m));

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
        {renderGroup(t("sidebar.groups.operations"), operations)}
        {renderGroup(t("sidebar.groups.insights"), insights)}
        {renderGroup(t("sidebar.groups.workspace"), admin)}
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && (
          <div className="rounded-md border bg-card p-3 text-xs">
            <div className="font-medium text-foreground">{t("sidebar.plan", { plan: workspace.plan })}</div>
            <div className="mt-0.5 text-muted-foreground">{t("sidebar.membersCount", { count: workspace.members })}</div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
