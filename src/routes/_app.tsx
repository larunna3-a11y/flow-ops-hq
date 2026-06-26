import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { useWorkspace } from "@/lib/use-workspace";
import { canAccess, HOME_PATH, moduleForPath } from "@/lib/permissions";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { data: ws, isLoading } = useWorkspace();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const role = ws?.role ?? null;

  useEffect(() => {
    if (isLoading || !role) return;
    const module = moduleForPath(pathname);
    if (module && !canAccess(role, module)) {
      navigate({ to: HOME_PATH[role], replace: true });
    }
  }, [pathname, role, isLoading, navigate]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset>
          <AppTopbar />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
